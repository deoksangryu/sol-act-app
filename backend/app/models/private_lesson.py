from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.lesson import Subject
from datetime import datetime
import enum


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PrivateLessonRequest(Base):
    __tablename__ = "private_lesson_requests"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)
    subject = Column(SQLEnum(Subject), nullable=False)
    preferred_date = Column(String, nullable=False)  # YYYY-MM-DD
    preferred_start_time = Column(String, nullable=False)  # HH:mm
    preferred_end_time = Column(String, nullable=False)  # HH:mm
    reason = Column(Text, nullable=False)
    status = Column(SQLEnum(RequestStatus), default=RequestStatus.PENDING, nullable=False)
    response_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    responded_at = Column(DateTime, nullable=True)

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    teacher = relationship("User", foreign_keys=[teacher_id])
