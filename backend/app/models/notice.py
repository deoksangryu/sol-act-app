from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, JSON
from app.database import Base
from datetime import datetime


class Notice(Base):
    __tablename__ = "notices"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=False)  # Store author name directly
    important = Column(Boolean, default=False, nullable=False)
    class_id = Column(String, nullable=True)  # (legacy) 단일 반. 신규는 target_class_ids 사용
    target_class_ids = Column(JSON, nullable=True)  # ["c1","c2"] 대상 반들 / null·[] = 전체 공지
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
