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

    # Relationships (cascade delete when user is removed)
    assignments = relationship("Assignment", back_populates="student", foreign_keys="Assignment.student_id", cascade="all, delete-orphan")
    diet_logs = relationship("DietLog", back_populates="student", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="author", cascade="all, delete-orphan")
    sent_messages = relationship("ChatMessage", back_populates="sender", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    lesson_journals = relationship("LessonJournal", back_populates="author", cascade="all, delete-orphan")
    attendances = relationship("Attendance", foreign_keys="Attendance.student_id", back_populates="student", cascade="all, delete-orphan")
    evaluations_received = relationship("Evaluation", foreign_keys="Evaluation.student_id", back_populates="student", cascade="all, delete-orphan")
    portfolios = relationship("Portfolio", back_populates="student", cascade="all, delete-orphan")
    portfolio_comments = relationship("PortfolioComment", back_populates="author", cascade="all, delete-orphan")
    auditions = relationship("Audition", back_populates="creator", cascade="all, delete-orphan")
