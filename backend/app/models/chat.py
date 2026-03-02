from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    sender = relationship("User", back_populates="sent_messages")
    class_info = relationship("ClassInfo", back_populates="messages")


class ChatReadStatus(Base):
    __tablename__ = "chat_read_status"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    class_id = Column(String, ForeignKey("classes.id"), primary_key=True)
    last_read_at = Column(DateTime, default=datetime.utcnow, nullable=False)
