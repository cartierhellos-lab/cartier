# Textron SMS Cloud - Python 发信服务

基于 Flask 的 TextNow 账号管理 & 短信发送服务。

## 环境要求
- Python 3.12+
- 虚拟环境（venv）

## 快速启动

```bash
# 克隆项目
git clone git@github.com:cartierhellos-lab/cartier.git
cd cartier

# 创建虚拟环境并安装依赖
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 启动服务（默认端口 5000）
python3 app.py
```

## 接口文档

| 方法 | 路径 | 功能 |
|------|------|------|
| GET  | /health | 健康检查，返回在线账号数 |
| GET  | /rsikNumber | 查询在线账号数量及列表 |
| GET  | /accounts | 账号列表（脱敏） |
| POST | /register | 注册账号到在线池 |
| POST | /unregister | 注销账号 |
| POST | /send | 发送文本或图片短信 |
| POST | /upload | 图片文件上传 |
| POST | /resendmess | 重发文件上传 |
| GET  | /getresendmesslist | 获取重发消息列表 |
| GET  | /getstart | 获取重发开始时间 |

## 注册账号示例

```bash
curl -X POST http://localhost:5000/register \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "1234567890",
    "cookie": "your_cookie",
    "xpx": "your_xpx_token",
    "client_id": "your_client_id",
    "email": "your@email.com",
    "device_info": "TextNow/26.15.0 (iPhone12,1; iOS 16.5; Scale/2.00)"
  }'
```

## 发送短信示例

```bash
curl -X POST http://localhost:5000/send \
  -H 'Content-Type: application/json' \
  -d '{
    "from_phone": "1234567890",
    "to_phone": "0987654321",
    "content": "Hello!",
    "message_type": 1
  }'
```

## 开机自启（systemd）

```bash
sudo systemctl enable textron.service
sudo systemctl start textron.service
sudo journalctl -u textron.service -f
```

## 目录结构

```
textron_sender/
├── app.py              # 主程序
├── requirements.txt    # 依赖列表
├── README.md           # 本文件
└── venv/               # 虚拟环境（不提交 Git）
```
