from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


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
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(String, nullable=False)  # e.g. "18:00"
    end_time = Column(String, nullable=False)  # e.g. "20:00"
    status = Column(SQLEnum(LessonStatus), default=LessonStatus.SCHEDULED, nullable=False)
    lesson_type = Column(SQLEnum(LessonType), default=LessonType.REGULAR, nullable=False)
    location = Column(String, nullable=True)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    class_info = relationship("ClassInfo", back_populates="lessons")
    journals = relationship("LessonJournal", back_populates="lesson", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="lesson", cascade="all, delete-orphan")
