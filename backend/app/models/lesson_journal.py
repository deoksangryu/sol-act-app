from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey, Enum as SQLEnum
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
    media_urls = Column(JSON, nullable=True)  # ["url1", "url2", ...] attached media
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    lesson = relationship("Lesson", back_populates="journals")
    author = relationship("User", back_populates="lesson_journals")
    comments = relationship(
        "LessonJournalComment", back_populates="journal",
        cascade="all, delete-orphan", order_by="LessonJournalComment.created_at",
    )


class LessonJournalComment(Base):
    """학생 일지에 대한 선생님 코칭 댓글."""
    __tablename__ = "lesson_journal_comments"

    id = Column(String, primary_key=True, index=True)
    journal_id = Column(String, ForeignKey("lesson_journals.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    journal = relationship("LessonJournal", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
