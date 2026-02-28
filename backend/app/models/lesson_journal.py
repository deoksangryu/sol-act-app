from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class JournalType(str, enum.Enum):
    TEACHER = "teacher"
    STUDENT = "student"


class LessonJournal(Base):
    __tablename__ = "lesson_journals"

    id = Column(String, primary_key=True, index=True)
    lesson_id = Column(String, ForeignKey("lessons.id"), nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    journal_type = Column(SQLEnum(JournalType), nullable=False)
    content = Column(Text, nullable=False)
    objectives = Column(Text, nullable=True)  # Teacher only
    next_plan = Column(Text, nullable=True)  # Teacher only
    ai_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    lesson = relationship("Lesson", back_populates="journals")
    author = relationship("User", back_populates="lesson_journals")
