#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Textron SMS Cloud - Python发信服务
端口: 5000
功能: TN账号在线管理、文件上传、图片代理
基于对旧服务器(170.106.183.92:5000)的逆向分析
"""
import os, json, time, logging, socket
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# 在线账号缓存 {phone: {cookie, xpx, device_info, ...}}
online_accounts = {}

def get_outbound_ip():
    """获取本机对外出口IP（发信时的真实出口IP）"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "unknown"

# ============================================================
# 1. 状态接口 - GET /rsikNumber (原平台调用此接口获取账号数)
# ============================================================
@app.route("/rsikNumber", methods=["GET"])
def risk_number():
    """账号在线/暂停数量查询（PHP后端和前端都调用此接口）"""
    phone = request.args.get("phone", "")
    if phone:
        is_online = phone in online_accounts
        return jsonify({
            "success": True,
            "online": is_online,
            "phone": phone,
            "number": len(online_accounts),
            "riskNumber": len(online_accounts)
        })
    return jsonify({
        "success": True,
        "number": len(online_accounts),
        "riskNumber": len(online_accounts),
        "phones": list(online_accounts.keys())
    })

# ============================================================
# 2. 账号注册接口 - POST /register
# ============================================================
@app.route("/register", methods=["POST"])
def register_account():
    """注册账号到在线池（PHP发信前调用）"""
    data = request.json or {}
    phone = data.get("phone") or data.get("myphonenumber")
    if not phone:
        return jsonify({"success": False, "message": "phone required"}), 400
    online_accounts[phone] = {
        "cookie": data.get("cookie", ""),
        "xpx": data.get("xpx", ""),
        "device_info": data.get("device_info", ""),
        "client_id": data.get("client_id", ""),
        "email": data.get("email", phone),
        "registered_at": int(time.time()),
    }
    logger.info(f"Account registered: {phone}, total: {len(online_accounts)}")
    return jsonify({"success": True, "message": "registered", "phone": phone, "riskNumber": len(online_accounts)})

# ============================================================
# 3. 账号注销 - POST /unregister
# ============================================================
@app.route("/unregister", methods=["POST"])
def unregister_account():
    data = request.json or {}
    phone = data.get("phone")
    if phone and phone in online_accounts:
        del online_accounts[phone]
    return jsonify({"success": True, "riskNumber": len(online_accounts)})

# ============================================================
# 4. 文件上传接口 - POST /upload
#    前端直接调用: Ae.post(`http://${getPythonUrl()}:5000/upload`, formData)
#    返回: {file_path: url} 或 {url: url}
# ============================================================
@app.route("/upload", methods=["POST"])
def upload_file():
    """图片上传接口 - 前端上传图片后获取URL再发图片消息"""
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "message": "No file part"}), 400
        
        f = request.files["file"]
        if not f.filename:
            return jsonify({"success": False, "message": "No selected file"}), 400
        
        # 生成唯一文件名
        ext = os.path.splitext(f.filename)[1] or '.jpg'
        fname = f"img_{int(time.time() * 1000)}{ext}"
        
        # 保存到Laravel的公共存储目录
        save_dir = "/var/www/textron/storage/app/public/uploads"
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, fname)
        f.save(save_path)
        
        # 生成可访问的URL
        server_ip = os.environ.get("SERVER_IP", "170.106.106.252")
        server_port = os.environ.get("SERVER_PORT", "80")
        port_str = f":{server_port}" if server_port not in ("80", "443") else ""
        url = f"http://{server_ip}{port_str}/storage/uploads/{fname}"
        
        logger.info(f"File uploaded: {fname} -> {url}")
        return jsonify({
            "success": True,
            "file_path": url,
            "url": url,
            "path": save_path,
            "filename": fname
        })
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500

# ============================================================
# 5. 账号发信接口 - POST /send (PHP后端调用，实际发TextNow消息)
#    PHP的MessageController调用此接口发送文本和图片
# ============================================================
@app.route("/send", methods=["POST"])
def send_message():
    """核心发信接口 - 由PHP后端调用"""
    data = request.json or {}
    from_phone  = data.get("from_phone") or data.get("phone")
    to_phone    = data.get("to_phone") or data.get("contact_value")
    content     = data.get("content") or data.get("message", "")
    msg_type    = int(data.get("message_type", 1))  # 1=文本 2=图片

    if not from_phone or not to_phone:
        return jsonify({"success": False, "message": "from_phone and to_phone required"}), 400

    # 获取账号信息
    account = online_accounts.get(from_phone)
    if not account:
        if data.get("cookie"):
            account = {
                "cookie": data["cookie"],
                "xpx": data.get("xpx", ""),
                "device_info": data.get("device_info", ""),
                "client_id": data.get("client_id", ""),
            }
        else:
            return jsonify({"success": False, "message": f"账号 {from_phone} 不在线，请先注册"}), 400

    try:
        if msg_type == 1:
            result = _send_text_tn(from_phone, to_phone, content, account)
        elif msg_type == 2:
            result = _send_image_tn(from_phone, to_phone, content, account)
        else:
            return jsonify({"success": False, "message": f"不支持的消息类型: {msg_type}"}), 400

        logger.info(f"Send type={msg_type} from={from_phone} to={to_phone}: success={result.get('success')}")
        if result.get('success'):
            result['send_ip'] = get_outbound_ip()
        return jsonify(result)

    except requests.exceptions.Timeout:
        return jsonify({"success": False, "message": "TextNow API请求超时"}), 504
    except requests.exceptions.ConnectionError as e:
        return jsonify({"success": False, "message": f"TextNow API连接失败: {str(e)[:100]}"}), 503
    except Exception as e:
        logger.error(f"Send error: {e}", exc_info=True)
        return jsonify({"success": False, "message": str(e)}), 500

def _build_headers(account):
    """构建TextNow请求头"""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": account.get("device_info") or "TextNow/26.19.0 (iPhone; iOS 16.0; Scale/3.00)",
        "X-TN-Client-Version": "26.19.0",
        "X-TN-OS-Version": "iOS 16.0",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if account.get("cookie"):
        headers["Cookie"] = account["cookie"]
    if account.get("xpx"):
        headers["X-PX-AUTHORIZATION"] = account["xpx"]
    if account.get("client_id"):
        headers["X-TN-Client-ID"] = account["client_id"]
    return headers

def _send_text_tn(from_phone, to_phone, content, account):
    """向TextNow发送文本消息"""
    headers = _build_headers(account)
    # TextNow API v3 messages endpoint (从网络抓包获得)
    url = "https://www.textnow.com/api/users/{}/messages".format(
        account.get("email", from_phone).split("@")[0]
    )
    payload = {
        "contact_value": to_phone,
        "contact_type": 2,
        "message": content,
        "read": 1,
        "message_direction": 2,
        "message_type": 1,
        "from_name": from_phone,
        "has_video": False,
        "date": int(time.time() * 1000),
        "from_number": from_phone,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    logger.info(f"TN text response: {resp.status_code} {resp.text[:200]}")
    if resp.status_code in [200, 201]:
        return {"success": True, "message": "发送成功"}
    else:
        return {"success": False, "message": f"TextNow返回 {resp.status_code}: {resp.text[:200]}"}

def _send_image_tn(from_phone, to_phone, img_url, account):
    """向TextNow发送图片消息"""
    headers = _build_headers(account)
    url = "https://www.textnow.com/api/users/{}/messages".format(
        account.get("email", from_phone).split("@")[0]
    )
    payload = {
        "contact_value": to_phone,
        "contact_type": 2,
        "message": "",
        "read": 1,
        "message_direction": 2,
        "message_type": 2,
        "from_name": from_phone,
        "has_video": False,
        "date": int(time.time() * 1000),
        "from_number": from_phone,
        "media_url": img_url,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    logger.info(f"TN image response: {resp.status_code} {resp.text[:200]}")
    if resp.status_code in [200, 201]:
        return {"success": True, "message": "图片发送成功"}
    else:
        return {"success": False, "message": f"TextNow返回 {resp.status_code}: {resp.text[:200]}"}

# ============================================================
# 6. 健康检查
# ============================================================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "online_count": len(online_accounts),
        "riskNumber": len(online_accounts),
        "time": int(time.time())
    })

# ============================================================
# 7. 账号列表（脱敏）
# ============================================================
@app.route("/accounts", methods=["GET"])
def list_accounts():
    result = []
    for phone, acc in online_accounts.items():
        result.append({
            "phone": phone,
            "has_cookie": bool(acc.get("cookie")),
            "has_xpx": bool(acc.get("xpx")),
            "registered_at": acc.get("registered_at"),
        })
    return jsonify({"success": True, "count": len(result), "accounts": result})

# ============================================================
# 8. 重发消息相关接口（cloud:resend功能）
# ============================================================
@app.route("/resendmess", methods=["POST"])
def resend_mess():
    """接收重发文件"""
    try:
        if "file" in request.files:
            f = request.files["file"]
            fname = f"resend_{int(time.time())}_{f.filename}"
            save_dir = "/tmp/resend_files"
            os.makedirs(save_dir, exist_ok=True)
            f.save(os.path.join(save_dir, fname))
            return jsonify({"success": True, "message": "文件上传成功", "filename": fname})
        return jsonify({"success": False, "message": "no file"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/getresendmesslist", methods=["GET"])
def get_resend_mess_list():
    """获取重发消息列表"""
    user_id = request.headers.get("userid", "")
    return jsonify({"success": True, "data": [], "total": 0, "user_id": user_id})

@app.route("/getstart", methods=["GET"])
def get_start():
    """获取重发开始时间"""
    return jsonify({"success": True, "start_time": None, "data": None})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Textron Python服务启动，端口: {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
