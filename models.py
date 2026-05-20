"""
models.py — SQLAlchemy ORM 层（适配 SQLite）
与 /www/wwwroot/cartier/database/database.sqlite 共用
"""

import datetime
import os
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    create_engine,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DB_PATH = os.getenv("DB_PATH", "/www/wwwroot/cartier/database/database.sqlite")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 10,
    },
    echo=False,
)

# 启用 WAL 模式 + 外键约束（SQLite 默认关闭）
from sqlalchemy import event


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _now():
    return datetime.datetime.now()


# ============================================================
# 1. 账号表
# ============================================================
class PhoneInfo(Base):
    __tablename__ = "cloud_phoneinfo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    myphonenumber = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=True)
    user_name = Column(String(100), nullable=True)
    account_type = Column(String(20), default="tn")
    status = Column(Integer, default=1)  # 1=正常 0=禁用
    online_status = Column(Integer, default=0)  # 1=在线 0=离线
    heartbeat_status = Column(String(20), default="NORMAL")  # NORMAL/BANNED/RISK
    auth_token = Column(String(255), nullable=True)
    xpx = Column(Text, nullable=True)
    cookie = Column(Text, nullable=True)
    device_info = Column(Text, nullable=True)
    client_id = Column(String(100), nullable=True)
    project_id = Column(Integer, nullable=True)
    is_service = Column(Integer, default=0)
    used = Column(Integer, default=0)
    send_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    last_heartbeat = Column(DateTime, nullable=True)
    last_send_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_ci_status", "status"),
        Index("idx_ci_online", "online_status"),
        Index("idx_ci_project", "project_id"),
        Index("idx_ci_hb_status", "heartbeat_status"),
    )


# ============================================================
# 2. 任务主表
# ============================================================
class TcardTask(Base):
    __tablename__ = "tcard_task"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_name = Column(String(200), nullable=False)
    project_key = Column(String(100), nullable=True)
    project_id = Column(Integer, nullable=True)
    status = Column(Integer, default=0)  # 0=待启动 1=运行 2=暂停 3=停止 4=完成
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    content = Column(Text, nullable=True)
    img_url = Column(Text, nullable=True)
    msg_type = Column(String(20), default="text")
    send_interval_time = Column(Integer, default=5)
    max_send_interval_time = Column(Integer, default=10)
    rest_minutes = Column(Integer, default=0)
    resend_minutes = Column(Integer, default=0)
    is_auto_assign_phoneinfo = Column(Integer, default=0)
    max_customer_service_count = Column(Integer, default=1000)
    started_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    details = relationship("TcardTaskDetail", back_populates="task", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_task_status", "status"),
        Index("idx_task_project", "project_id"),
    )


# ============================================================
# 3. 任务详情表（每条发送记录）
# ============================================================
class TcardTaskDetail(Base):
    __tablename__ = "tcard_task_detail"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tcard_task.id", ondelete="CASCADE"), nullable=True)
    phoneinfo_id = Column(Integer, nullable=True)
    to_number = Column(String(30), nullable=True)
    content = Column(Text, nullable=True)
    msg_type = Column(String(20), default="text")
    task_uuid = Column(String(36), nullable=True)
    status = Column(Integer, default=0)  # 0=PENDING 1=SENDING 2=SUCCESS 3=FAIL
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    send_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    task = relationship("TcardTask", back_populates="details")

    __table_args__ = (
        Index("idx_td_status", "status"),
        Index("idx_td_task_id", "task_id"),
        Index("idx_td_phoneinfo_id", "phoneinfo_id"),
    )


# ============================================================
# 4. 会话表
# ============================================================
class TcardConversation(Base):
    __tablename__ = "tcard_conversation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, nullable=True)
    phoneinfo_id = Column(Integer, nullable=True)
    customer_id = Column(Integer, default=0)
    other_number = Column(String(30), nullable=True)
    my_number = Column(String(30), nullable=True)
    last_message = Column(Text, nullable=True)
    unread_count = Column(Integer, default=0)
    is_favorite = Column(Integer, default=0)
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    messages = relationship("TcardMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_conv_phoneinfo", "phoneinfo_id"),
        Index("idx_conv_project", "project_id"),
        Index("idx_conv_updated", "last_message_at"),
        Index("idx_conv_unread", "unread_count"),
    )


# ============================================================
# 5. 消息表
# ============================================================
class TcardMessage(Base):
    __tablename__ = "tcard_message"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("tcard_conversation.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(Integer, nullable=True)
    from_number = Column(String(30), nullable=True)
    to_number = Column(String(30), nullable=True)
    from_id = Column(Integer, nullable=True)
    to_id = Column(Integer, nullable=True)
    content = Column(Text, nullable=True)
    msg_type = Column(String(20), default="text")
    direction = Column(Integer, default=1)  # 1=收到 2=发出
    is_read = Column(Integer, default=0)
    is_risk = Column(Integer, default=0)
    is_blacklist = Column(Integer, default=0)
    send_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    conversation = relationship("TcardConversation", back_populates="messages")

    __table_args__ = (
        Index("idx_msg_conv_id", "conversation_id"),
        Index("idx_msg_direction", "direction"),
        Index("idx_msg_is_read", "is_read"),
    )


# ============================================================
# 6. 收件记录表
# ============================================================
class CloudReceivedMessage(Base):
    __tablename__ = "cloud_received_message"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, nullable=True)
    phoneinfo_id = Column(Integer, nullable=True)
    conversation_id = Column(Integer, nullable=True)
    from_number = Column(String(30), nullable=True)
    to_number = Column(String(30), nullable=True)
    content = Column(Text, nullable=True)
    is_read = Column(Integer, default=0)
    received_at = Column(DateTime, nullable=True, default=_now)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        Index("idx_rm_phoneinfo", "phoneinfo_id"),
        Index("idx_rm_conv", "conversation_id"),
        Index("idx_rm_from", "from_number"),
        Index("idx_rm_read", "is_read"),
    )


# ============================================================
# 7. 项目表
# ============================================================
class CloudProject(Base):
    __tablename__ = "cloud_project"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_name = Column(String(200), nullable=False)
    project_key = Column(String(100), nullable=False, unique=True)
    account_type = Column(String(20), default="tn")
    project_type = Column(Integer, default=1)
    max_send_count = Column(Integer, default=100)
    send_interval = Column(Integer, default=300)
    status = Column(Integer, default=1)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (Index("idx_proj_key", "project_key"),)


# ============================================================
# CRUD 工具函数
# ============================================================
def get_db():
    """返回一个 SQLAlchemy Session，用 with 语句或手动 close"""
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


def create_account(
    phone: str,
    token: str = None,
    cookie: str = "",
    xpx: str = "",
    device_info: str = "",
    client_id: str = "",
    user_name: str = "",
    project_id: int = None,
) -> PhoneInfo:
    db = SessionLocal()
    try:
        existing = db.query(PhoneInfo).filter((PhoneInfo.myphonenumber == phone) | (PhoneInfo.phone == phone)).first()
        if existing:
            existing.cookie = cookie or existing.cookie
            existing.xpx = xpx or existing.xpx
            existing.device_info = device_info or existing.device_info
            existing.client_id = client_id or existing.client_id
            existing.online_status = 1
            existing.heartbeat_status = "NORMAL"
            existing.last_heartbeat = _now()
            existing.updated_at = _now()
            db.commit()
            db.refresh(existing)
            return existing
        acc = PhoneInfo(
            myphonenumber=phone,
            phone=phone,
            user_name=user_name,
            auth_token=token,
            cookie=cookie,
            xpx=xpx,
            device_info=device_info,
            client_id=client_id,
            project_id=project_id,
            online_status=1,
            heartbeat_status="NORMAL",
            last_heartbeat=_now(),
        )
        db.add(acc)
        db.commit()
        db.refresh(acc)
        return acc
    finally:
        db.close()


def get_account_by_phone(phone: str) -> PhoneInfo | None:
    db = SessionLocal()
    try:
        return db.query(PhoneInfo).filter((PhoneInfo.myphonenumber == phone) | (PhoneInfo.phone == phone)).first()
    finally:
        db.close()


def upsert_conversation(
    phoneinfo_id: int, other_number: str, my_number: str, content: str, project_id: int = None
) -> TcardConversation:
    db = SessionLocal()
    try:
        conv = db.query(TcardConversation).filter_by(phoneinfo_id=phoneinfo_id, other_number=other_number).first()
        n = _now()
        if conv:
            conv.last_message = content[:200]
            conv.unread_count = (conv.unread_count or 0) + 1
            conv.last_message_at = n
            conv.updated_at = n
        else:
            conv = TcardConversation(
                project_id=project_id,
                phoneinfo_id=phoneinfo_id,
                other_number=other_number,
                my_number=my_number,
                last_message=content[:200],
                unread_count=1,
                last_message_at=n,
            )
            db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv
    finally:
        db.close()


def save_message(
    conv_id: int,
    from_number: str,
    to_number: str,
    content: str,
    direction: int = 1,
    msg_type: str = "text",
    project_id: int = None,
) -> TcardMessage:
    db = SessionLocal()
    try:
        msg = TcardMessage(
            conversation_id=conv_id,
            project_id=project_id,
            from_number=from_number,
            to_number=to_number,
            content=content,
            msg_type=msg_type,
            direction=direction,
            is_read=0,
            send_at=_now(),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
    finally:
        db.close()


def save_received(
    phoneinfo_id: int, conv_id: int, from_number: str, to_number: str, content: str, project_id: int = None
) -> CloudReceivedMessage:
    db = SessionLocal()
    try:
        # 去重：5分钟内同源同内容
        from sqlalchemy import func

        exists = (
            db.query(CloudReceivedMessage)
            .filter(
                CloudReceivedMessage.phoneinfo_id == phoneinfo_id,
                CloudReceivedMessage.from_number == from_number,
                CloudReceivedMessage.content == content,
                CloudReceivedMessage.received_at >= datetime.datetime.now() - datetime.timedelta(minutes=5),
            )
            .first()
        )
        if exists:
            return exists
        rm = CloudReceivedMessage(
            project_id=project_id,
            phoneinfo_id=phoneinfo_id,
            conversation_id=conv_id,
            from_number=from_number,
            to_number=to_number,
            content=content,
            is_read=0,
            received_at=_now(),
        )
        db.add(rm)
        db.commit()
        db.refresh(rm)
        return rm
    finally:
        db.close()


if __name__ == "__main__":
    # 测试连接
    db = SessionLocal()
    acc_count = db.query(PhoneInfo).count()
    task_count = db.query(TcardTask).count()
    conv_count = db.query(TcardConversation).count()
    db.close()
    print(f"✅ models.py 连接成功 | 账号:{acc_count} 任务:{task_count} 会话:{conv_count}")
