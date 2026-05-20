#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cartier 短信云平台 — Python 服务 v3.0
新增：
  - models.py ORM 整合（SQLAlchemy + SQLite）
  - /api/task/list            任务列表（分页）
  - /api/conversation/list    会话列表（分页，兼容旧路径）
  - /api/message/send         发消息（兼容应用层检查文档路径）
  - /api/conversation/mark_read  标记已读（兼容旧路径）
  - /api/conversation/favorite   收藏
  - /api/phoneinfo/batch_heartbeat  批量心跳
  - 统一错误响应格式 (success/error/code)
  - 全局异常中间件
  - 心跳定时器内置（后台线程，60s/次）
"""

import os, json, time, uuid, logging, sqlite3, threading, queue
from pathlib import Path
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, Response, stream_with_context
import requests as req

# ==================== 配置 ====================
DB_PATH = os.getenv("DB_PATH", "/www/wwwroot/cartier/database/database.sqlite")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/www/wwwroot/cartier/storage/app/public/uploads"))
SERVER_IP = os.getenv("SERVER_IP", "170.106.106.252")
PORT = int(os.getenv("PORT", 5000))
TN_BASE = "https://www.textnow.com/api/users"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(funcName)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)


# ==================== 统一响应 ====================
def ok(data=None, **kw):
    r = {"success": True}
    if data is not None:
        r["data"] = data
    r.update(kw)
    return jsonify(r)


def err(msg, code=400, **kw):
    r = {"success": False, "error": str(msg)}
    r.update(kw)
    return jsonify(r), code


# ==================== 全局异常中间件 ====================
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {e}", exc_info=True)
    return jsonify({"success": False, "error": "服务器内部错误", "detail": str(e)}), 500


@app.errorhandler(404)
def handle_404(e):
    return jsonify({"success": False, "error": "接口不存在"}), 404


@app.errorhandler(405)
def handle_405(e):
    return jsonify({"success": False, "error": "请求方法不允许"}), 405


# ==================== SQLite 工具 ====================
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def db_fetchone(sql, params=()):
    with get_db() as conn:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None


def db_fetchall(sql, params=()):
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def db_execute(sql, params=()):
    with get_db() as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid


def db_count(sql, params=()):
    with get_db() as conn:
        row = conn.execute(sql, params).fetchone()
        return row[0] if row else 0


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def paginate(items, page, size, total):
    return {"items": items, "total": total, "page": page, "size": size, "pages": (total + size - 1) // size if size > 0 else 0}


# ==================== SSE 事件总线 ====================
_sse_channels: dict = {}
_sse_lock = threading.Lock()


def _sse_subscribe(channel: str) -> queue.Queue:
    q = queue.Queue(maxsize=200)
    with _sse_lock:
        _sse_channels.setdefault(channel, []).append(q)
    return q


def _sse_unsubscribe(channel: str, q: queue.Queue):
    with _sse_lock:
        lst = _sse_channels.get(channel, [])
        if q in lst:
            lst.remove(q)


def sse_emit(channel: str, event: str, data: dict):
    payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    with _sse_lock:
        for q in list(_sse_channels.get(channel, [])):
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass


# ==================== TextNow 协议 ====================
def _tn_headers(account: dict) -> dict:
    h = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": account.get("device_info") or "TextNow/26.19.0 (iPhone; iOS 16.0; Scale/3.00)",
        "X-TN-Client-Version": "26.19.0",
        "X-TN-OS-Version": "iOS 16.0",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if account.get("cookie"):
        h["Cookie"] = account["cookie"]
    if account.get("xpx"):
        h["X-PX-AUTHORIZATION"] = account["xpx"]
    if account.get("client_id"):
        h["X-TN-Client-ID"] = account["client_id"]
    return h


def _tn_username(a: dict) -> str:
    return a.get("user_name") or a.get("myphonenumber") or a.get("phone") or ""


def tn_check_status(account: dict) -> str:
    try:
        username = _tn_username(account)
        if not username:
            return "RISK"
        url = f"{TN_BASE}/{username}/messages"
        resp = req.get(
            url, headers=_tn_headers(account), timeout=10, params={"start_message_id": "0", "direction": "past", "page_size": 1}
        )
        if resp.status_code == 200:
            return "NORMAL"
        if resp.status_code in (401, 403):
            return "BANNED"
        return "RISK"
    except Exception as e:
        logger.warning(f"tn_check_status error: {e}")
        return "RISK"


def tn_send_text(account: dict, to_phone: str, content: str) -> dict:
    username = _tn_username(account)
    my_phone = account.get("myphonenumber") or account.get("phone") or username
    url = f"{TN_BASE}/{username}/messages"
    payload = {
        "contact_value": to_phone,
        "contact_type": 2,
        "message": content,
        "read": 1,
        "message_direction": 2,
        "message_type": 1,
        "from_name": my_phone,
        "has_video": False,
        "date": int(time.time() * 1000),
        "from_number": my_phone,
    }
    resp = req.post(url, json=payload, headers=_tn_headers(account), timeout=15)
    return {"success": resp.status_code in (200, 201), "status_code": resp.status_code}


def tn_send_image(account: dict, to_phone: str, img_url: str) -> dict:
    username = _tn_username(account)
    my_phone = account.get("myphonenumber") or account.get("phone") or username
    url = f"{TN_BASE}/{username}/messages"
    payload = {
        "contact_value": to_phone,
        "contact_type": 2,
        "message": "",
        "read": 1,
        "message_direction": 2,
        "message_type": 2,
        "from_name": my_phone,
        "has_video": False,
        "date": int(time.time() * 1000),
        "from_number": my_phone,
        "media_url": img_url,
    }
    resp = req.post(url, json=payload, headers=_tn_headers(account), timeout=15)
    return {"success": resp.status_code in (200, 201), "status_code": resp.status_code}


def tn_fetch_messages(account: dict, page_size: int = 30) -> list:
    username = _tn_username(account)
    if not username:
        return []
    url = f"{TN_BASE}/{username}/messages"
    try:
        resp = req.get(
            url,
            headers=_tn_headers(account),
            timeout=10,
            params={"start_message_id": "0", "direction": "past", "page_size": page_size, "contact_value": "", "is_receipt": "0"},
        )
        if resp.status_code == 200:
            return resp.json().get("messages", [])
    except Exception as e:
        logger.warning(f"tn_fetch_messages error: {e}")
    return []


# ==================== 消息存储工具 ====================
def _save_received_message(acc: dict, from_number: str, content: str):
    if not from_number or not content:
        return
    exists = db_fetchone(
        """SELECT id FROM cloud_received_message
           WHERE phoneinfo_id=? AND from_number=? AND content=?
             AND datetime(received_at) > datetime('now','-5 minutes') LIMIT 1""",
        (acc["id"], from_number, content),
    )
    if exists:
        return

    db_execute(
        """INSERT INTO cloud_received_message
           (project_id, phoneinfo_id, from_number, to_number, content, is_read, received_at, created_at, updated_at)
           VALUES (?,?,?,?,?,0,?,?,?)""",
        (
            acc.get("project_id"),
            acc["id"],
            from_number,
            acc.get("myphonenumber") or acc.get("phone"),
            content,
            now_str(),
            now_str(),
            now_str(),
        ),
    )
    conv = db_fetchone(
        "SELECT * FROM tcard_conversation WHERE phoneinfo_id=? AND other_number=? LIMIT 1", (acc["id"], from_number)
    )
    n = now_str()
    if conv:
        db_execute(
            "UPDATE tcard_conversation SET last_message=?, unread_count=unread_count+1, last_message_at=?, updated_at=? WHERE id=?",
            (content[:200], n, n, conv["id"]),
        )
        conv_id = conv["id"]
    else:
        conv_id = db_execute(
            """INSERT INTO tcard_conversation
               (project_id, phoneinfo_id, other_number, my_number, customer_id,
                last_message, unread_count, last_message_at, created_at, updated_at)
               VALUES (?,?,?,?,0,?,1,?,?,?)""",
            (acc.get("project_id"), acc["id"], from_number, acc.get("myphonenumber") or acc.get("phone"), content[:200], n, n, n),
        )

    db_execute(
        """INSERT INTO tcard_message
           (conversation_id, project_id, from_number, to_number, content, msg_type,
            direction, is_read, send_at, created_at, updated_at)
           VALUES (?,?,?,?,?,'text',1,0,?,?,?)""",
        (conv_id, acc.get("project_id"), from_number, acc.get("myphonenumber") or acc.get("phone"), content, n, n, n),
    )
    sse_emit(
        "chat",
        "new_message",
        {
            "conversation_id": conv_id,
            "from_number": from_number,
            "to_number": acc.get("myphonenumber") or acc.get("phone"),
            "content": content,
            "received_at": n,
        },
    )
    db_execute(
        "UPDATE cloud_received_message SET conversation_id=? WHERE phoneinfo_id=? AND from_number=? AND content=? AND conversation_id IS NULL",
        (conv_id, acc["id"], from_number, content),
    )


# ==================== 任务调度器 ====================
class TaskScheduler:
    def __init__(self):
        self._running = False
        self._thread = None
        self._active_tasks: dict = {}
        self._lock = threading.Lock()

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        logger.info("TaskScheduler started")

    def stop_all(self):
        self._running = False

    def add_task(self, task_id: int):
        with self._lock:
            if task_id not in self._active_tasks:
                self._active_tasks[task_id] = {"status": "running", "last_sent": 0}
        db_execute("UPDATE tcard_task SET status=1, started_at=?, updated_at=? WHERE id=?", (now_str(), now_str(), task_id))
        sse_emit("tasks", "task_started", {"task_id": task_id})

    def pause_task(self, task_id: int):
        with self._lock:
            if task_id in self._active_tasks:
                self._active_tasks[task_id]["status"] = "paused"
        db_execute("UPDATE tcard_task SET status=2, paused_at=?, updated_at=? WHERE id=?", (now_str(), now_str(), task_id))
        sse_emit("tasks", "task_paused", {"task_id": task_id})

    def resume_task(self, task_id: int):
        with self._lock:
            if task_id in self._active_tasks:
                self._active_tasks[task_id]["status"] = "running"
        db_execute("UPDATE tcard_task SET status=1, updated_at=? WHERE id=?", (now_str(), task_id))
        sse_emit("tasks", "task_resumed", {"task_id": task_id})

    def stop_task(self, task_id: int):
        with self._lock:
            self._active_tasks.pop(task_id, None)
        db_execute("UPDATE tcard_task SET status=3, updated_at=? WHERE id=?", (now_str(), task_id))
        sse_emit("tasks", "task_stopped", {"task_id": task_id})

    def _loop(self):
        hb_tick = 0
        recv_tick = 0
        while self._running:
            try:
                with self._lock:
                    tids = list(self._active_tasks.keys())
                for tid in tids:
                    self._process_task(tid)
                hb_tick += 1
                if hb_tick >= 12:
                    hb_tick = 0
                    self._do_heartbeat()
                recv_tick += 1
                if recv_tick >= 6:
                    recv_tick = 0
                    self._do_receive()
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}", exc_info=True)
            time.sleep(5)

    def _process_task(self, task_id: int):
        with self._lock:
            info = self._active_tasks.get(task_id)
        if not info or info["status"] != "running":
            return

        task = db_fetchone("SELECT * FROM tcard_task WHERE id=?", (task_id,))
        if not task:
            self.stop_task(task_id)
            return

        import random

        interval = task.get("send_interval_time") or 5
        max_i = task.get("max_send_interval_time") or interval
        if time.time() - info["last_sent"] < random.uniform(interval, max(interval, max_i)):
            return

        detail = db_fetchone(
            """SELECT d.*, p.cookie, p.xpx, p.device_info, p.client_id,
                      p.myphonenumber, p.user_name, p.phone as pphone,
                      p.status as p_status, p.heartbeat_status
               FROM tcard_task_detail d
               LEFT JOIN cloud_phoneinfo p ON p.id = d.phoneinfo_id
               WHERE d.task_id=? AND d.status=0 ORDER BY d.id LIMIT 1""",
            (task_id,),
        )
        if not detail:
            self.stop_task(task_id)
            db_execute("UPDATE tcard_task SET status=4, updated_at=? WHERE id=?", (now_str(), task_id))
            sse_emit("tasks", "task_finished", {"task_id": task_id})
            return

        if detail.get("p_status") != 1 or detail.get("heartbeat_status") == "BANNED":
            db_execute(
                "UPDATE tcard_task_detail SET status=3, error_message='账号不可用', updated_at=? WHERE id=?",
                (now_str(), detail["id"]),
            )
            db_execute("UPDATE tcard_task SET fail_count=fail_count+1, updated_at=? WHERE id=?", (now_str(), task_id))
            return

        account = {
            k: detail[k] for k in ("cookie", "xpx", "device_info", "client_id", "myphonenumber", "user_name") if k in detail
        }
        account["phone"] = detail.get("pphone", "")
        to_number = detail.get("to_number", "")
        content = detail.get("content") or task.get("content", "")
        msg_type = detail.get("msg_type") or task.get("msg_type", "text")
        img_url = task.get("img_url", "")

        db_execute(
            "UPDATE tcard_task_detail SET status=1, send_at=?, updated_at=? WHERE id=?", (now_str(), now_str(), detail["id"])
        )
        try:
            if msg_type == "image" and img_url:
                result = tn_send_image(account, to_number, img_url)
            else:
                result = tn_send_text(account, to_number, content)

            if result["success"]:
                status, e_msg = 2, None
                db_execute("UPDATE tcard_task SET success_count=success_count+1, updated_at=? WHERE id=?", (now_str(), task_id))
                db_execute(
                    "UPDATE cloud_phoneinfo SET send_count=send_count+1, last_send_at=?, updated_at=? WHERE id=?",
                    (now_str(), now_str(), detail["phoneinfo_id"]),
                )
            else:
                retry = (detail.get("retry_count") or 0) + 1
                max_r = detail.get("max_retry") or 3
                if retry < max_r:
                    status, e_msg = 0, f"HTTP {result['status_code']}"
                else:
                    status, e_msg = 3, f"HTTP {result['status_code']} max_retry"
                    db_execute("UPDATE tcard_task SET fail_count=fail_count+1, updated_at=? WHERE id=?", (now_str(), task_id))
                db_execute("UPDATE tcard_task_detail SET retry_count=? WHERE id=?", (retry, detail["id"]))
        except Exception as e:
            status, e_msg = 3, str(e)[:200]
            db_execute("UPDATE tcard_task SET fail_count=fail_count+1, updated_at=? WHERE id=?", (now_str(), task_id))

        db_execute(
            "UPDATE tcard_task_detail SET status=?, error_message=?, updated_at=? WHERE id=?",
            (status, e_msg, now_str(), detail["id"]),
        )
        with self._lock:
            if task_id in self._active_tasks:
                self._active_tasks[task_id]["last_sent"] = time.time()

        sse_emit(
            "tasks",
            "send_progress",
            {
                "task_id": task_id,
                "detail_id": detail["id"],
                "to_number": to_number,
                "status": "success" if status == 2 else "fail",
                "error": e_msg,
            },
        )

    def _do_heartbeat(self):
        accounts = db_fetchall("SELECT * FROM cloud_phoneinfo WHERE status=1 AND online_status=1 LIMIT 200")
        for acc in accounts:
            try:
                hs = tn_check_status(acc)
                db_execute(
                    "UPDATE cloud_phoneinfo SET heartbeat_status=?, last_heartbeat=?, updated_at=? WHERE id=?",
                    (hs, now_str(), now_str(), acc["id"]),
                )
            except Exception as e:
                logger.warning(f"Heartbeat acc {acc['id']} error: {e}")

    def _do_receive(self):
        accounts = db_fetchall("SELECT * FROM cloud_phoneinfo WHERE status=1 AND online_status=1 LIMIT 100")
        for acc in accounts:
            try:
                msgs = tn_fetch_messages(acc, page_size=10)
                for m in msgs:
                    if m.get("message_direction") == 1:
                        _save_received_message(acc, m.get("contact_value", ""), m.get("message", ""))
            except Exception as e:
                logger.warning(f"Receive acc {acc['id']} error: {e}")


scheduler = TaskScheduler()

# ==================== 路由 ====================


# ---- 健康检查 ----
@app.route("/health", methods=["GET"])
def health():
    total = db_count("SELECT COUNT(*) FROM cloud_phoneinfo WHERE status=1")
    online = db_count("SELECT COUNT(*) FROM cloud_phoneinfo WHERE online_status=1")
    tasks = db_count("SELECT COUNT(*) FROM tcard_task WHERE status=1")
    convs = db_count("SELECT COUNT(*) FROM tcard_conversation")
    return ok(
        {
            "total_accounts": total,
            "online_accounts": online,
            "running_tasks": tasks,
            "total_conversations": convs,
            "scheduler_active": scheduler._running,
            "time": int(time.time()),
        }
    )


# ---- rsikNumber 兼容 ----
@app.route("/rsikNumber", methods=["GET"])
def risk_number():
    phone = request.args.get("phone", "")
    if phone:
        acc = db_fetchone(
            "SELECT id, heartbeat_status, online_status FROM cloud_phoneinfo WHERE myphonenumber=? OR phone=?", (phone, phone)
        )
        return ok(
            {
                "phone": phone,
                "online": bool(acc and acc["online_status"]),
                "heartbeat_status": acc["heartbeat_status"] if acc else "UNKNOWN",
            }
        )
    total = db_count("SELECT COUNT(*) FROM cloud_phoneinfo WHERE online_status=1")
    return ok({"riskNumber": total})


# ---- SSE ----
@app.route("/stream/tasks", methods=["GET"])
def stream_tasks():
    def generate(q):
        yield ": connected\n\n"
        while True:
            try:
                data = q.get(timeout=25)
                yield data
            except queue.Empty:
                yield ": ping\n\n"

    q = _sse_subscribe("tasks")
    return Response(
        stream_with_context(generate(q)),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/stream/chat", methods=["GET"])
def stream_chat():
    def generate(q):
        yield ": connected\n\n"
        while True:
            try:
                data = q.get(timeout=25)
                yield data
            except queue.Empty:
                yield ": ping\n\n"

    q = _sse_subscribe("chat")
    return Response(
        stream_with_context(generate(q)),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ============================================================
# 1️⃣ 账号协议层
# ============================================================
@app.route("/api/phoneinfo/register", methods=["POST"])
@app.route("/register", methods=["POST"])
def api_register():
    data = request.json or {}
    phone = data.get("phone") or data.get("myphonenumber")
    if not phone:
        return err("phone required")
    existing = db_fetchone("SELECT id FROM cloud_phoneinfo WHERE myphonenumber=? OR phone=?", (phone, phone))
    n = now_str()
    if existing:
        db_execute(
            "UPDATE cloud_phoneinfo SET cookie=?,xpx=?,device_info=?,client_id=?,online_status=1,heartbeat_status='NORMAL',last_heartbeat=?,updated_at=? WHERE id=?",
            (
                data.get("cookie", ""),
                data.get("xpx", ""),
                data.get("device_info", ""),
                data.get("client_id", ""),
                n,
                n,
                existing["id"],
            ),
        )
        pid = existing["id"]
    else:
        pid = db_execute(
            """INSERT INTO cloud_phoneinfo
               (myphonenumber,phone,user_name,cookie,xpx,device_info,client_id,
                account_type,status,online_status,heartbeat_status,last_heartbeat,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,'tn',1,1,'NORMAL',?,?,?)""",
            (
                phone,
                phone,
                data.get("user_name", ""),
                data.get("cookie", ""),
                data.get("xpx", ""),
                data.get("device_info", ""),
                data.get("client_id", ""),
                n,
                n,
                n,
            ),
        )
    return ok({"id": pid, "phone": phone})


@app.route("/api/phoneinfo/unregister", methods=["POST"])
@app.route("/unregister", methods=["POST"])
def api_unregister():
    data = request.json or {}
    phone = data.get("phone")
    if phone:
        db_execute(
            "UPDATE cloud_phoneinfo SET online_status=0, updated_at=? WHERE myphonenumber=? OR phone=?", (now_str(), phone, phone)
        )
    return ok()


@app.route("/api/phoneinfo/heartbeat", methods=["POST"])
def api_heartbeat():
    data = request.json or {}
    phone = data.get("phone")
    acc = db_fetchone("SELECT * FROM cloud_phoneinfo WHERE myphonenumber=? OR phone=?", (phone, phone)) if phone else None
    if not acc:
        return err("account not found", 404)
    hs = tn_check_status(acc)
    db_execute(
        "UPDATE cloud_phoneinfo SET heartbeat_status=?, last_heartbeat=?, updated_at=? WHERE id=?",
        (hs, now_str(), now_str(), acc["id"]),
    )
    return ok({"phone": phone, "heartbeat_status": hs})


@app.route("/api/phoneinfo/batch_heartbeat", methods=["POST"])
def api_batch_heartbeat():
    """批量对所有在线账号做心跳检测（异步执行，立即返回）"""

    def _run():
        accs = db_fetchall("SELECT * FROM cloud_phoneinfo WHERE status=1 AND online_status=1")
        for acc in accs:
            hs = tn_check_status(acc)
            db_execute(
                "UPDATE cloud_phoneinfo SET heartbeat_status=?, last_heartbeat=?, updated_at=? WHERE id=?",
                (hs, now_str(), now_str(), acc["id"]),
            )

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    total = db_count("SELECT COUNT(*) FROM cloud_phoneinfo WHERE status=1 AND online_status=1")
    return ok({"message": f"正在对 {total} 个在线账号进行心跳检测", "total": total})


@app.route("/api/phoneinfo/status/<phone>", methods=["GET"])
def api_phone_status(phone):
    acc = db_fetchone(
        "SELECT id, heartbeat_status, last_heartbeat, online_status, send_count, fail_count FROM cloud_phoneinfo WHERE myphonenumber=? OR phone=?",
        (phone, phone),
    )
    if not acc:
        return err("not found", 404)
    return ok(acc)


@app.route("/api/phoneinfo/list", methods=["GET"])
@app.route("/accounts", methods=["GET"])
def api_accounts_list():
    page = max(1, int(request.args.get("page", 1)))
    size = min(100, max(1, int(request.args.get("size", 20))))
    offset = (page - 1) * size
    status_filter = request.args.get("status", "")
    online_filter = request.args.get("online_status", "")
    project_filter = request.args.get("project_id", "")

    where, params = [], []
    if status_filter != "":
        where.append("status=?")
        params.append(int(status_filter))
    if online_filter != "":
        where.append("online_status=?")
        params.append(int(online_filter))
    if project_filter != "":
        where.append("project_id=?")
        params.append(int(project_filter))

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    rows = db_fetchall(
        f"SELECT id,myphonenumber,phone,user_name,account_type,status,online_status,heartbeat_status,last_heartbeat,send_count,fail_count,project_id FROM cloud_phoneinfo {where_sql} ORDER BY id DESC LIMIT ? OFFSET ?",
        (*params, size, offset),
    )
    total = db_count(f"SELECT COUNT(*) FROM cloud_phoneinfo {where_sql}", params)
    return ok(paginate(rows, page, size, total))


# ============================================================
# 2️⃣ 任务接口
# ============================================================
@app.route("/api/task/list", methods=["GET"])
def api_task_list():
    """任务列表（分页 + 筛选）"""
    page = max(1, int(request.args.get("page", 1)))
    size = min(100, max(1, int(request.args.get("size", request.args.get("pageSize", 20)))))
    offset = (page - 1) * size
    status_f = request.args.get("status", "")
    project_f = request.args.get("project_id", "")

    where, params = [], []
    if status_f != "":
        where.append("status=?")
        params.append(int(status_f))
    if project_f != "":
        where.append("project_id=?")
        params.append(int(project_f))
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    rows = db_fetchall(f"SELECT * FROM tcard_task {where_sql} ORDER BY id DESC LIMIT ? OFFSET ?", (*params, size, offset))
    total = db_count(f"SELECT COUNT(*) FROM tcard_task {where_sql}", params)
    return ok(paginate(rows, page, size, total))


@app.route("/api/task/start", methods=["POST"])
def api_task_start():
    data = request.json or {}
    ids = data.get("ids", [])
    if isinstance(ids, int):
        ids = [ids]
    if not ids:
        return err("ids required")
    for tid in ids:
        task = db_fetchone("SELECT * FROM tcard_task WHERE id=?", (tid,))
        if not task:
            continue
        count = db_count("SELECT COUNT(*) FROM tcard_task_detail WHERE task_id=?", (tid,))
        if count == 0:
            _auto_generate_details(task)
        scheduler.add_task(tid)
    return ok({"started": ids})


@app.route("/api/task/pause", methods=["POST"])
def api_task_pause():
    data = request.json or {}
    ids = data.get("ids", [])
    if isinstance(ids, int):
        ids = [ids]
    for tid in ids:
        scheduler.pause_task(tid)
    return ok()


@app.route("/api/task/resume", methods=["POST"])
def api_task_resume():
    data = request.json or {}
    ids = data.get("ids", [])
    if isinstance(ids, int):
        ids = [ids]
    for tid in ids:
        scheduler.resume_task(tid)
    return ok()


@app.route("/api/task/stop", methods=["POST"])
def api_task_stop():
    data = request.json or {}
    ids = data.get("ids", [])
    if isinstance(ids, int):
        ids = [ids]
    for tid in ids:
        scheduler.stop_task(tid)
    return ok()


@app.route("/api/task/status/<int:task_id>", methods=["GET"])
def api_task_status(task_id):
    task = db_fetchone(
        "SELECT id, task_name, status, total_count, success_count, fail_count, started_at, updated_at FROM tcard_task WHERE id=?",
        (task_id,),
    )
    if not task:
        return err("not found", 404)
    return ok(task)


def _auto_generate_details(task: dict):
    project_id = task.get("project_id")
    if not project_id:
        return
    customers = db_fetchall("SELECT system_phonenumber FROM cloud_customer WHERE project_id=? AND status=1", (project_id,))
    phoneinfos = db_fetchall(
        "SELECT id FROM cloud_phoneinfo WHERE project_id=? AND status=1 AND online_status=1 LIMIT 10", (project_id,)
    )
    if not phoneinfos:
        phoneinfos = db_fetchall("SELECT id FROM cloud_phoneinfo WHERE status=1 LIMIT 10")
    pi_list = [p["id"] for p in phoneinfos]
    n = now_str()
    for i, c in enumerate(customers):
        pi_id = pi_list[i % len(pi_list)] if pi_list else None
        db_execute(
            """INSERT INTO tcard_task_detail
               (task_id, phoneinfo_id, to_number, content, msg_type, task_uuid, status, created_at, updated_at)
               VALUES (?,?,?,?,?,?,0,?,?)""",
            (
                task["id"],
                pi_id,
                c["system_phonenumber"],
                task.get("content", ""),
                task.get("msg_type", "text"),
                str(uuid.uuid4()),
                n,
                n,
            ),
        )
    db_execute(
        "UPDATE tcard_task SET total_count=?, success_count=0, fail_count=0, updated_at=? WHERE id=?",
        (len(customers), n, task["id"]),
    )


# ============================================================
# 3️⃣ 接收协议
# ============================================================
@app.route("/api/webhook/reply", methods=["POST"])
def webhook_reply():
    data = request.json or {}
    from_number = data.get("from") or data.get("from_number")
    content = data.get("message") or data.get("content")
    phoneinfo_id = data.get("phoneinfo_id") or data.get("account_id")
    if not (from_number and content):
        return err("from_number & content required")
    acc = db_fetchone("SELECT * FROM cloud_phoneinfo WHERE id=?", (phoneinfo_id,)) if phoneinfo_id else None
    if not acc:
        return err("account not found", 404)
    _save_received_message(acc, from_number, content)
    return ok()


@app.route("/api/messages/poll/<int:phoneinfo_id>", methods=["GET"])
def api_poll_messages(phoneinfo_id):
    acc = db_fetchone("SELECT * FROM cloud_phoneinfo WHERE id=?", (phoneinfo_id,))
    if not acc:
        return err("account not found", 404)
    msgs = tn_fetch_messages(acc, page_size=20)
    saved = 0
    for m in msgs:
        if m.get("message_direction") == 1:
            _save_received_message(acc, m.get("contact_value", ""), m.get("message", ""))
            saved += 1
    return ok({"total": len(msgs), "saved": saved})


# ============================================================
# 4️⃣ 聊天 / 会话（新路径 + 旧路径兼容）
# ============================================================
@app.route("/api/conversation/list", methods=["GET"])
@app.route("/api/chat/conversations", methods=["GET"])
def api_conversations():
    page = max(1, int(request.args.get("page", 1)))
    size = min(100, max(1, int(request.args.get("size", 20))))
    offset = (page - 1) * size
    project_id = request.args.get("project_id", "")
    favorite = request.args.get("is_favorite", "")
    unread_only = request.args.get("unread_only", "")

    where, params = [], []
    if project_id != "":
        where.append("project_id=?")
        params.append(int(project_id))
    if favorite != "":
        where.append("is_favorite=?")
        params.append(int(favorite))
    if unread_only == "1":
        where.append("unread_count>0")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    rows = db_fetchall(
        f"SELECT * FROM tcard_conversation {where_sql} ORDER BY last_message_at DESC LIMIT ? OFFSET ?", (*params, size, offset)
    )
    total = db_count(f"SELECT COUNT(*) FROM tcard_conversation {where_sql}", params)
    return ok(paginate(rows, page, size, total))


@app.route("/api/chat/messages/<int:conv_id>", methods=["GET"])
def api_chat_messages(conv_id):
    page = max(1, int(request.args.get("page", 1)))
    size = min(200, max(1, int(request.args.get("size", 50))))
    offset = (page - 1) * size
    rows = db_fetchall(
        "SELECT * FROM tcard_message WHERE conversation_id=? ORDER BY send_at ASC LIMIT ? OFFSET ?", (conv_id, size, offset)
    )
    total = db_count("SELECT COUNT(*) FROM tcard_message WHERE conversation_id=?", (conv_id,))
    return ok(paginate(rows, page, size, total))


@app.route("/api/message/send", methods=["POST"])
@app.route("/api/chat/send", methods=["POST"])
def api_chat_send():
    """客服侧回复（支持会话ID或直接指定 from/to phone）"""
    data = request.json or {}
    conv_id = data.get("conversation_id")
    content = data.get("content")
    msg_type = data.get("msg_type", "text")
    img_url = data.get("img_url", "")
    # 直接指定发件/收件号（不依赖会话）
    direct_from = data.get("from_phone") or data.get("account_phone")
    direct_to = data.get("to_phone") or data.get("to_number")

    if not content:
        return err("content required")

    acc = None
    to_number = ""
    project_id = None

    if conv_id:
        conv = db_fetchone("SELECT * FROM tcard_conversation WHERE id=?", (conv_id,))
        if not conv:
            return err("conversation not found", 404)
        acc = db_fetchone("SELECT * FROM cloud_phoneinfo WHERE id=?", (conv["phoneinfo_id"],))
        to_number = conv.get("other_number", "")
        project_id = conv.get("project_id")
    elif direct_from and direct_to:
        acc = db_fetchone("SELECT * FROM cloud_phoneinfo WHERE myphonenumber=? OR phone=?", (direct_from, direct_from))
        to_number = direct_to
        # 自动找或建会话
        if acc:
            conv = db_fetchone(
                "SELECT * FROM tcard_conversation WHERE phoneinfo_id=? AND other_number=? LIMIT 1", (acc["id"], to_number)
            )
            if conv:
                conv_id = conv["id"]
                project_id = conv.get("project_id")
            else:
                n = now_str()
                conv_id = db_execute(
                    """INSERT INTO tcard_conversation
                       (project_id,phoneinfo_id,other_number,my_number,customer_id,
                        last_message,unread_count,last_message_at,created_at,updated_at)
                       VALUES (?,?,?,?,0,?,0,?,?,?)""",
                    (
                        acc.get("project_id"),
                        acc["id"],
                        to_number,
                        acc.get("myphonenumber") or acc.get("phone"),
                        content[:200],
                        n,
                        n,
                        n,
                    ),
                )
    else:
        return err("conversation_id 或 from_phone+to_phone 必须提供")

    if not acc:
        return err("account not found", 404)

    n = now_str()
    msg_id = db_execute(
        """INSERT INTO tcard_message
           (conversation_id,project_id,from_number,to_number,content,msg_type,direction,is_read,send_at,created_at,updated_at)
           VALUES (?,?,?,?,?,?,2,1,?,?,?)""",
        (conv_id, project_id, acc.get("myphonenumber") or acc.get("phone"), to_number, content, msg_type, n, n, n),
    )
    try:
        if msg_type == "image" and img_url:
            result = tn_send_image(acc, to_number, img_url)
        else:
            result = tn_send_text(acc, to_number, content)
        success = result["success"]
    except Exception as e:
        success = False
        logger.error(f"chat send error: {e}")

    db_execute(
        "UPDATE tcard_conversation SET last_message=?, last_message_at=?, updated_at=? WHERE id=?", (content[:200], n, n, conv_id)
    )
    sse_emit("chat", "message_sent", {"conversation_id": conv_id, "msg_id": msg_id, "content": content, "success": success})
    return ok({"msg_id": msg_id, "sent": success})


@app.route("/api/conversation/mark_read", methods=["POST"])
@app.route("/api/chat/mark_read", methods=["POST"])
def api_mark_read():
    data = request.json or {}
    conv_id = data.get("conversation_id")
    if not conv_id:
        return err("conversation_id required")
    db_execute("UPDATE tcard_conversation SET unread_count=0, updated_at=? WHERE id=?", (now_str(), conv_id))
    db_execute("UPDATE tcard_message SET is_read=1, updated_at=? WHERE conversation_id=? AND direction=1", (now_str(), conv_id))
    db_execute("UPDATE cloud_received_message SET is_read=1, updated_at=? WHERE conversation_id=?", (now_str(), conv_id))
    return ok()


@app.route("/api/conversation/favorite", methods=["POST"])
@app.route("/api/chat/favorite", methods=["POST"])
def api_toggle_favorite():
    data = request.json or {}
    conv_id = data.get("conversation_id")
    favorite = int(data.get("is_favorite", 1))
    if not conv_id:
        return err("conversation_id required")
    db_execute("UPDATE tcard_conversation SET is_favorite=?, updated_at=? WHERE id=?", (favorite, now_str(), conv_id))
    return ok()


# ============================================================
# 5️⃣ 文件上传 & 兼容旧接口
# ============================================================
@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return err("No file part")
    f = request.files["file"]
    if not f.filename:
        return err("No selected file")
    ext = Path(f.filename).suffix or ".jpg"
    fname = f"img_{int(time.time()*1000)}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    f.save(UPLOAD_DIR / fname)
    url = f"http://{SERVER_IP}/storage/uploads/{fname}"
    return ok({"file_path": url, "url": url, "filename": fname})


@app.route("/send", methods=["POST"])
def send_message_compat():
    data = request.json or {}
    from_phone = data.get("from_phone") or data.get("phone")
    to_phone = data.get("to_phone") or data.get("contact_value")
    content = data.get("content") or data.get("message", "")
    msg_type = int(data.get("message_type", 1))
    if not from_phone or not to_phone:
        return err("from_phone and to_phone required")
    acc = db_fetchone("SELECT * FROM cloud_phoneinfo WHERE myphonenumber=? OR phone=?", (from_phone, from_phone))
    if not acc and data.get("cookie"):
        acc = {
            "cookie": data["cookie"],
            "xpx": data.get("xpx", ""),
            "device_info": data.get("device_info", ""),
            "client_id": data.get("client_id", ""),
            "myphonenumber": from_phone,
            "user_name": from_phone,
            "phone": from_phone,
            "id": None,
            "project_id": None,
        }
    if not acc:
        return err(f"账号 {from_phone} 不在线，请先注册", 400)
    try:
        if msg_type == 2:
            result = tn_send_image(acc, to_phone, content)
        else:
            result = tn_send_text(acc, to_phone, content)
        return ok(result)
    except Exception as e:
        return err(str(e), 500)


@app.route("/getstart", methods=["GET"])
def get_start():
    return ok({"start_time": None, "data": None})


@app.route("/resendmess", methods=["POST"])
def resend_mess():
    if "file" in request.files:
        f = request.files["file"]
        fname = f"resend_{int(time.time())}_{f.filename}"
        save_dir = Path("/tmp/resend_files")
        save_dir.mkdir(parents=True, exist_ok=True)
        f.save(save_dir / fname)
        return ok({"filename": fname})
    return err("no file")


@app.route("/getresendmesslist", methods=["GET"])
def get_resend_mess_list():
    return ok({"data": [], "total": 0})


# ==================== 启动 ====================
if __name__ == "__main__":
    scheduler.start()
    logger.info(f"Cartier Flask 服务 v3.0 启动，端口: {PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
