from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from app.database import Base
from datetime import datetime


class Notice(Base):
    __tablename__ = "notices"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=False)  # Store author name directly
    important = Column(Boolean, default=False, nullable=False)
    class_id = Column(String, nullable=True)  # null = academy-wide, set = class-specific
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
