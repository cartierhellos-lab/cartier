# Cartier 短信云平台 — 部署运维手册

## 项目概述
基于 Laravel 13（API层） + Flask Python（协议层） + SQLite 的短信发送管理系统。
支持 TextNow (TN) 账号协议、任务批量发送、双向聊天、实时 SSE 推送。

---

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| API 框架 | Laravel | 13.x |
| 协议服务 | Flask | 3.0.2 |
| ORM | SQLAlchemy | 2.0.49 |
| 数据库 | SQLite (WAL) | 3.x |
| Web服务器 | Nginx (宝塔) | latest |
| PHP | PHP-FPM | 8.3 |
| 进程管理 | systemd | - |

---

## 目录结构

```
/www/wwwroot/cartier/
├── app/                    # Laravel 应用
├── public/                 # Web根目录
│   ├── index.html          # 前端入口
│   ├── js/
│   │   ├── api.js          # API层（v2.0）
│   │   ├── layout.js       # 布局组件
│   │   ├── pages.js        # 页面渲染
│   │   └── pages_chat.js   # 聊天页面
│   └── css/main.css
├── app.py                  # Flask 协议服务（v3.0）
├── models.py               # SQLAlchemy ORM 层
├── requirements.txt        # Python 依赖锁定
├── alembic/                # 数据库迁移
├── tests/test_app.py       # 38个单元+集成测试
└── database/database.sqlite
```

---

## 快速启动

```bash
# 启动 Flask 协议服务
sudo systemctl start cartier-flask
sudo systemctl status cartier-flask

# 查看实时日志
sudo journalctl -u cartier-flask -f

# 重启服务
sudo systemctl restart cartier-flask
```

---

## API 端点（Flask 协议层 :5000）

### 健康检查
```
GET /health
→ {"success":true,"data":{"total_accounts":N,"online_accounts":N,"running_tasks":N,...}}
```

### 账号协议层
```
POST /api/phoneinfo/register    注册/上线账号
POST /api/phoneinfo/unregister  账号下线
POST /api/phoneinfo/heartbeat   单账号心跳检测
POST /api/phoneinfo/batch_heartbeat  批量心跳（异步）
GET  /api/phoneinfo/status/{phone}   查询账号状态
GET  /api/phoneinfo/list             账号列表（分页）
```

### 任务调度
```
GET  /api/task/list             任务列表（分页）
POST /api/task/start            启动任务 {"ids":[1,2]}
POST /api/task/pause            暂停任务
POST /api/task/resume           恢复任务
POST /api/task/stop             停止任务
GET  /api/task/status/{id}      查询任务状态
```

### 聊天/消息
```
GET  /api/conversation/list               会话列表
GET  /api/chat/messages/{conv_id}         消息历史
POST /api/message/send                    发送消息
POST /api/conversation/mark_read          标记已读
POST /api/conversation/favorite           收藏会话
POST /api/webhook/reply                   接收外部回调
GET  /api/messages/poll/{phoneinfo_id}    手动拉取新消息
```

### SSE 实时推送
```
GET /stream/tasks   任务进度推送（task_started/stopped/send_progress等）
GET /stream/chat    聊天消息推送（new_message/message_sent）
```

### 文件上传
```
POST /upload        multipart/form-data，file字段
→ {"success":true,"url":"http://IP/storage/uploads/img_XXX.jpg"}
```

---

## 访问入口

| 入口 | 地址 |
|---|---|
| 前端管理界面 | http://170.106.106.252/ |
| 登录账号 | admin / admin123456 |
| Flask 健康 | http://170.106.106.252/health |
| 宝塔面板 | http://170.106.106.252:31838/cc394bb1 |

---

## 数据库

```bash
# 连接查看
sqlite3 /www/wwwroot/cartier/database/database.sqlite

# 常用查询
.tables
SELECT COUNT(*) FROM cloud_phoneinfo WHERE online_status=1;
SELECT * FROM tcard_task ORDER BY id DESC LIMIT 5;
SELECT * FROM tcard_conversation ORDER BY last_message_at DESC LIMIT 5;

# Alembic 迁移（新功能上线时）
cd /www/wwwroot/cartier
alembic revision --autogenerate -m "describe_change"
alembic upgrade head
```

---

## CI 测试

```bash
cd /www/wwwroot/cartier
python3 -m pytest tests/ -v --tb=short
# 当前: 38 passed, 0 failed
```

---

## 安全扫描

```bash
# Bandit 代码扫描
cd /www/wwwroot/cartier
python3 -m bandit app.py models.py -ll

# pip CVE 检查
pip-audit --requirement requirements.txt
```

---

## 监控

- **健康探针**: cron 每分钟执行 `/usr/local/bin/cartier-health-check.sh`
- **服务日志**: `sudo journalctl -u cartier-flask -f`
- **Nginx日志**: `/www/wwwlogs/cartier.access.log`
- **日志轮转**: `/etc/logrotate.d/cartier-flask`（每日压缩，保留14天）

---

## 已知问题 & 注意事项

1. **Flask 使用开发服务器**：生产建议迁移至 Gunicorn（`gunicorn -w 4 app:app`）
2. **Alembic upgrade**：现有 SQLite 表含引号默认值，`upgrade head` 会因 batch_alter 报错；
   新增字段用 `ALTER TABLE ADD COLUMN` 手动执行，或重建表。
3. **TextNow API**：账号 cookie/xpx 有效期约24h，需客户端定时续签。
4. **SQLite 并发**：WAL 模式支持多读单写，高并发写入建议切换 PostgreSQL。

---

## 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0 | 2026-05-19 | 初始部署：Laravel + 前端UI |
| v2.0 | 2026-05-20 | Flask 协议服务 + 账号/任务/聊天 |
| v3.0 | 2026-05-20 | ORM层 + 完整接口 + 38个测试 + CI验收 |
