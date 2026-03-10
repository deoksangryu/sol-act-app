from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class PraiseSticker(Base):
    __tablename__ = "praise_stickers"

    id = Column(String, primary_key=True, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=False)
    emoji = Column(String, nullable=False)  # e.g. "⭐", "🏆", "💪"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_stickers")
    recipient = relationship("User", foreign_keys=[recipient_id], backref="received_stickers")
