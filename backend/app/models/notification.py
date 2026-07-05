from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class NotificationType(str, enum.Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"


class Notification(Base):
    __tablename__ = "notifications"
    # 알림 목록(매 로그인): WHERE user_id=? ORDER BY created_at DESC LIMIT 100.
    # (user_id, created_at) 복합 인덱스로 전체 풀스캔+정렬 → 인덱스 역방향 스캔으로 전환.
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(SQLEnum(NotificationType), nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")
