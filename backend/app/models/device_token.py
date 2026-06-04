from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class DeviceToken(Base):
    """네이티브 푸시(FCM/APNs)용 디바이스 토큰.

    웹푸시(PushSubscription)와 별개로, Capacitor 네이티브 앱이 등록한 토큰을 저장한다.
    platform: 'ios'(APNs 토큰) | 'android'(FCM 토큰).
    """
    __tablename__ = "device_tokens"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True)
    platform = Column(String, nullable=False)  # 'ios' | 'android'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
