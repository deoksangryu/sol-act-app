from sqlalchemy import Column, String, Text, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class AssignmentStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    GRADED = "graded"


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    due_date = Column(DateTime, nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(SQLEnum(AssignmentStatus), default=AssignmentStatus.PENDING, nullable=False)
    attachment_url = Column(String, nullable=True)  # Teacher-attached file (view-only for students)
    submission_text = Column(Text, nullable=True)
    submission_file_url = Column(String, nullable=True)
    feedback = Column(Text, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    grade = Column(String, nullable=True)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User", back_populates="assignments", foreign_keys=[student_id])
