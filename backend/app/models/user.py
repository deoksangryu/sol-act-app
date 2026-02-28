from sqlalchemy import Column, String, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    DIRECTOR = "director"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False)
    avatar = Column(String, nullable=True)

    # Relationships
    assignments = relationship("Assignment", back_populates="student", foreign_keys="Assignment.student_id")
    diet_logs = relationship("DietLog", back_populates="student")
    questions = relationship("Question", back_populates="author")
    sent_messages = relationship("ChatMessage", back_populates="sender")
    notifications = relationship("Notification", back_populates="user")
    taught_classes = relationship("ClassInfo", back_populates="teacher", foreign_keys="ClassInfo.teacher_id")
    lesson_journals = relationship("LessonJournal", back_populates="author")
    attendances = relationship("Attendance", foreign_keys="Attendance.student_id", back_populates="student")
    evaluations_received = relationship("Evaluation", foreign_keys="Evaluation.student_id", back_populates="student")
    portfolios = relationship("Portfolio", back_populates="student")
    portfolio_comments = relationship("PortfolioComment", back_populates="author")
    auditions = relationship("Audition", back_populates="creator")
