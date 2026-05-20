"""
tests/test_app.py — Cartier Flask Service CI 测试套件
覆盖：单元测试 + 集成测试 + API 端点测试
运行：pytest tests/ -v --tb=short
"""
import json
import os
import sys
import tempfile
import sqlite3
import pytest

# 让测试使用临时数据库
_tmp_db = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
_tmp_db.close()
os.environ["DB_PATH"] = _tmp_db.name
os.environ["PORT"] = "5099"

sys.path.insert(0, "/www/wwwroot/cartier")
import app as flask_app


# ==================== Fixtures ====================
@pytest.fixture(scope="session", autouse=True)
def init_db():
    """初始化测试数据库表结构"""
    conn = sqlite3.connect(_tmp_db.name)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS cloud_phoneinfo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            myphonenumber VARCHAR, phone VARCHAR, user_name VARCHAR,
            account_type VARCHAR DEFAULT 'tn', status INTEGER DEFAULT 1,
            online_status INTEGER DEFAULT 0, heartbeat_status VARCHAR DEFAULT 'NORMAL',
            auth_token VARCHAR, xpx TEXT, cookie TEXT, device_info TEXT, client_id VARCHAR,
            project_id INTEGER, is_service INTEGER DEFAULT 0, used INTEGER DEFAULT 0,
            send_count INTEGER DEFAULT 0, fail_count INTEGER DEFAULT 0,
            last_heartbeat DATETIME, last_send_at DATETIME,
            created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS tcard_task (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name VARCHAR NOT NULL, project_key VARCHAR, project_id INTEGER,
            status INTEGER DEFAULT 0, total_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0, fail_count INTEGER DEFAULT 0,
            content TEXT, img_url TEXT, msg_type VARCHAR DEFAULT 'text',
            send_interval_time INTEGER DEFAULT 5, max_send_interval_time INTEGER DEFAULT 10,
            rest_minutes INTEGER DEFAULT 0, resend_minutes INTEGER DEFAULT 0,
            is_auto_assign_phoneinfo INTEGER DEFAULT 0, max_customer_service_count INTEGER DEFAULT 1000,
            started_at DATETIME, paused_at DATETIME, created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS tcard_task_detail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER, phoneinfo_id INTEGER, to_number VARCHAR,
            content TEXT, msg_type VARCHAR DEFAULT 'text', task_uuid VARCHAR,
            status INTEGER DEFAULT 0, retry_count INTEGER DEFAULT 0, max_retry INTEGER DEFAULT 3,
            error_message TEXT, send_at DATETIME, created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS tcard_conversation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, phoneinfo_id INTEGER, customer_id INTEGER DEFAULT 0,
            other_number VARCHAR, my_number VARCHAR, last_message TEXT,
            unread_count INTEGER DEFAULT 0, is_favorite INTEGER DEFAULT 0,
            last_message_at DATETIME, created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS tcard_message (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER, project_id INTEGER,
            from_number VARCHAR, to_number VARCHAR,
            from_id INTEGER, to_id INTEGER, content TEXT,
            msg_type VARCHAR DEFAULT 'text', direction INTEGER DEFAULT 1,
            is_read INTEGER DEFAULT 0, is_risk INTEGER DEFAULT 0, is_blacklist INTEGER DEFAULT 0,
            send_at DATETIME, created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS cloud_received_message (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, phoneinfo_id INTEGER, conversation_id INTEGER,
            from_number VARCHAR, to_number VARCHAR, content TEXT,
            is_read INTEGER DEFAULT 0, received_at DATETIME, created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS cloud_customer (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            system_phonenumber VARCHAR, project_key VARCHAR, project_id INTEGER,
            status INTEGER DEFAULT 1, created_at DATETIME, updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS cloud_project (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name VARCHAR NOT NULL, project_key VARCHAR NOT NULL UNIQUE,
            account_type VARCHAR DEFAULT 'tn', project_type INTEGER DEFAULT 1,
            max_send_count INTEGER DEFAULT 100, send_interval INTEGER DEFAULT 300,
            status INTEGER DEFAULT 1, created_at DATETIME, updated_at DATETIME
        );
    """
    )
    conn.commit()
    conn.close()
    yield
    os.unlink(_tmp_db.name)


@pytest.fixture
def client():
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as c:
        yield c


# ==================== 单元测试 ====================
class TestUtils:
    def test_now_str_format(self):
        result = flask_app.now_str()
        assert len(result) == 19
        assert result[4] == "-"

    def test_paginate(self):
        p = flask_app.paginate([1, 2, 3], page=1, size=10, total=25)
        assert p["total"] == 25
        assert p["pages"] == 3
        assert p["page"] == 1

    def test_paginate_last_page(self):
        p = flask_app.paginate([], page=3, size=10, total=25)
        assert p["pages"] == 3

    def test_db_fetchone_missing(self):
        result = flask_app.db_fetchone("SELECT * FROM cloud_phoneinfo WHERE id=999999")
        assert result is None

    def test_db_count(self):
        count = flask_app.db_count("SELECT COUNT(*) FROM cloud_phoneinfo")
        assert isinstance(count, int)
        assert count >= 0


# ==================== API 路由测试 ====================
class TestHealth:
    def test_health_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert "total_accounts" in data["data"]
        assert "scheduler_active" in data["data"]

    def test_risk_number(self, client):
        r = client.get("/rsikNumber")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True

    def test_risk_number_with_phone(self, client):
        r = client.get("/rsikNumber?phone=10000000000")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "phone" in data["data"]


class TestErrorHandlers:
    def test_404(self, client):
        r = client.get("/nonexistent_endpoint_xyz")
        assert r.status_code == 404
        data = json.loads(r.data)
        assert data["success"] is False
        assert "error" in data

    def test_missing_params_returns_400(self, client):
        r = client.post("/api/phoneinfo/register",
                        json={}, content_type="application/json")
        assert r.status_code == 400
        data = json.loads(r.data)
        assert data["success"] is False


class TestPhoneInfo:
    def test_register_new_account(self, client):
        r = client.post("/api/phoneinfo/register",
                        json={"phone": "15000000001", "cookie": "test_cookie"},
                        content_type="application/json")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert data["data"]["phone"] == "15000000001"

    def test_register_duplicate(self, client):
        client.post("/api/phoneinfo/register",
                    json={"phone": "15000000002"}, content_type="application/json")
        r = client.post("/api/phoneinfo/register",
                        json={"phone": "15000000002"}, content_type="application/json")
        assert r.status_code == 200

    def test_unregister(self, client):
        client.post("/api/phoneinfo/register",
                    json={"phone": "15000000003"}, content_type="application/json")
        r = client.post("/api/phoneinfo/unregister",
                        json={"phone": "15000000003"}, content_type="application/json")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True

    def test_phone_status_not_found(self, client):
        r = client.get("/api/phoneinfo/status/99999999999")
        assert r.status_code == 404

    def test_phone_status_found(self, client):
        client.post("/api/phoneinfo/register",
                    json={"phone": "15000000004"}, content_type="application/json")
        r = client.get("/api/phoneinfo/status/15000000004")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert data["data"]["heartbeat_status"] == "NORMAL"

    def test_list_accounts(self, client):
        r = client.get("/api/phoneinfo/list?page=1&size=10")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert "items" in data["data"]
        assert "total" in data["data"]

    def test_list_accounts_pagination(self, client):
        r = client.get("/api/phoneinfo/list?page=1&size=2")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert len(data["data"]["items"]) <= 2

    def test_batch_heartbeat(self, client):
        r = client.post("/api/phoneinfo/batch_heartbeat")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True


class TestTaskAPI:
    def _create_task(self, client):
        """直接写入数据库创建任务（跳过 Laravel 侧）"""
        flask_app.db_execute(
            "INSERT INTO tcard_task (task_name, status, msg_type, created_at, updated_at) VALUES ('测试任务', 0, 'text', ?, ?)",
            (flask_app.now_str(), flask_app.now_str()),
        )
        row = flask_app.db_fetchone("SELECT id FROM tcard_task ORDER BY id DESC LIMIT 1")
        return row["id"]

    def test_task_list(self, client):
        r = client.get("/api/task/list?page=1&size=10")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert "items" in data["data"]

    def test_task_list_pagination(self, client):
        r = client.get("/api/task/list?page=1&size=2")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["data"]["size"] == 2

    def test_task_status_not_found(self, client):
        r = client.get("/api/task/status/999999")
        assert r.status_code == 404

    def test_task_status_found(self, client):
        tid = self._create_task(client)
        r = client.get(f"/api/task/status/{tid}")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert data["data"]["id"] == tid

    def test_task_start_missing_ids(self, client):
        r = client.post("/api/task/start", json={}, content_type="application/json")
        assert r.status_code == 400

    def test_task_stop(self, client):
        tid = self._create_task(client)
        r = client.post("/api/task/stop",
                        json={"ids": [tid]}, content_type="application/json")
        assert r.status_code == 200


class TestConversationAPI:
    def _create_conv(self):
        n = flask_app.now_str()
        conv_id = flask_app.db_execute(
            "INSERT INTO tcard_conversation (phoneinfo_id, other_number, my_number, last_message, unread_count, last_message_at, created_at, updated_at) VALUES (1, '13000000001', '15000000001', 'hello', 2, ?, ?, ?)",
            (n, n, n),
        )
        return conv_id

    def test_conversation_list(self, client):
        r = client.get("/api/conversation/list?page=1&size=10")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert "items" in data["data"]

    def test_conversation_list_new_path(self, client):
        r = client.get("/api/chat/conversations?page=1&size=10")
        assert r.status_code == 200

    def test_mark_read_missing_id(self, client):
        r = client.post("/api/conversation/mark_read",
                        json={}, content_type="application/json")
        assert r.status_code == 400

    def test_mark_read_ok(self, client):
        cid = self._create_conv()
        r = client.post("/api/conversation/mark_read",
                        json={"conversation_id": cid}, content_type="application/json")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        # 验证 unread_count 已清零
        conv = flask_app.db_fetchone("SELECT unread_count FROM tcard_conversation WHERE id=?", (cid,))
        assert conv["unread_count"] == 0

    def test_favorite_ok(self, client):
        cid = self._create_conv()
        r = client.post("/api/conversation/favorite",
                        json={"conversation_id": cid, "is_favorite": 1},
                        content_type="application/json")
        assert r.status_code == 200
        conv = flask_app.db_fetchone("SELECT is_favorite FROM tcard_conversation WHERE id=?", (cid,))
        assert conv["is_favorite"] == 1

    def test_messages_list(self, client):
        cid = self._create_conv()
        r = client.get(f"/api/chat/messages/{cid}?page=1&size=20")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True


class TestWebhook:
    def test_webhook_missing_params(self, client):
        r = client.post("/api/webhook/reply",
                        json={"from_number": "13000000000"},
                        content_type="application/json")
        assert r.status_code == 400

    def test_webhook_account_not_found(self, client):
        r = client.post("/api/webhook/reply",
                        json={"from_number": "13000000000", "content": "hi",
                              "phoneinfo_id": 999999},
                        content_type="application/json")
        assert r.status_code == 404

    def test_webhook_ok(self, client):
        # 先注册账号
        reg = client.post("/api/phoneinfo/register",
                          json={"phone": "15888888888"}, content_type="application/json")
        acc_id = json.loads(reg.data)["data"]["id"]
        r = client.post("/api/webhook/reply",
                        json={"from_number": "13999999999", "content": "test message",
                              "phoneinfo_id": acc_id},
                        content_type="application/json")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True

        # 验证消息已写入会话
        conv = flask_app.db_fetchone(
            "SELECT * FROM tcard_conversation WHERE other_number=?", ("13999999999",)
        )
        assert conv is not None
        assert conv["last_message"] == "test message"
        assert conv["unread_count"] == 1


class TestMessageSend:
    def test_send_missing_content(self, client):
        r = client.post("/api/message/send",
                        json={"from_phone": "15000000001", "to_phone": "13000000000"},
                        content_type="application/json")
        assert r.status_code == 400

    def test_send_no_account(self, client):
        r = client.post("/api/message/send",
                        json={"from_phone": "10000000000", "to_phone": "13000000000",
                              "content": "hello"},
                        content_type="application/json")
        assert r.status_code == 404

    def test_send_creates_conversation(self, client):
        # 注册账号
        reg = client.post("/api/phoneinfo/register",
                          json={"phone": "16000000001", "cookie": "c"},
                          content_type="application/json")
        # 发消息（sent=false 因为 cookie 是假的，但会话应该建立）
        r = client.post("/api/message/send",
                        json={"from_phone": "16000000001", "to_phone": "14000000001",
                              "content": "integration test"},
                        content_type="application/json")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["success"] is True
        assert "msg_id" in data["data"]


class TestUpload:
    def test_upload_no_file(self, client):
        r = client.post("/upload")
        assert r.status_code in (400, 415)

    def test_compat_routes(self, client):
        r = client.get("/getstart")
        assert r.status_code == 200
        r = client.get("/getresendmesslist")
        assert r.status_code == 200
