from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class Subject(str, enum.Enum):
    ACTING = "acting"
    MUSICAL = "musical"
    DANCE = "dance"


class LessonStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class LessonType(str, enum.Enum):
    REGULAR = "regular"
    MAKEUP = "makeup"
    SPECIAL = "special"


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(String, primary_key=True, index=True)
    class_id = Column(String, ForeignKey("classes.id"), nullable=True)
    date = Column(Date, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    status = Column(SQLEnum(LessonStatus), default=LessonStatus.SCHEDULED, nullable=False)
    lesson_type = Column(SQLEnum(LessonType), default=LessonType.REGULAR, nullable=False)
    subject = Column(SQLEnum(Subject), default=Subject.ACTING, nullable=False)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=True)
    location = Column(String, nullable=True)
    memo = Column(Text, nullable=True)
    is_private = Column(Boolean, default=False, nullable=False)
    private_student_ids = Column(JSON, nullable=True)  # ["s1", "s2"]
    request_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    class_info = relationship("ClassInfo", back_populates="lessons")
    teacher = relationship("User", foreign_keys=[teacher_id])
    journals = relationship("LessonJournal", back_populates="lesson", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="lesson", cascade="all, delete-orphan")
