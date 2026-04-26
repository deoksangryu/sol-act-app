from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class PortfolioCategory(str, enum.Enum):
    ACTING = "acting"
    DANCE = "dance"
    MUSICAL = "musical"
    BASICS = "basics"
    MONOLOGUE = "monologue"
    SCENE = "scene"
    IMPROV = "improv"
    AUDITION_PREP = "audition_prep"
    OTHER = "other"


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    video_url = Column(String, nullable=False)
    category = Column(SQLEnum(PortfolioCategory), nullable=False)
    tags = Column(String, nullable=True)  # Comma-separated
    ai_feedback = Column(Text, nullable=True)
    practice_group = Column(String, nullable=True)  # Groups repeated practice recordings
    video_duration = Column(Integer, nullable=True)  # Duration in seconds
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User", back_populates="portfolios")
    comments = relationship("PortfolioComment", back_populates="portfolio", cascade="all, delete-orphan")
    videos = relationship("PortfolioVideo", back_populates="portfolio", cascade="all, delete-orphan", order_by="PortfolioVideo.sort_order")
    attachments = relationship("PortfolioAttachment", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioVideo(Base):
    __tablename__ = "portfolio_videos"

    id = Column(String, primary_key=True, index=True)
    portfolio_id = Column(String, ForeignKey("portfolios.id"), nullable=False, index=True)
    video_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="videos")


class PortfolioComment(Base):
    __tablename__ = "portfolio_comments"

    id = Column(String, primary_key=True, index=True)
    portfolio_id = Column(String, ForeignKey("portfolios.id"), nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp_sec = Column(Integer, nullable=True)  # Video timestamp in seconds for time-specific comments
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="comments")
    author = relationship("User", back_populates="portfolio_comments")


class PortfolioAttachment(Base):
    __tablename__ = "portfolio_attachments"

    id = Column(String, primary_key=True, index=True)
    portfolio_id = Column(String, ForeignKey("portfolios.id"), nullable=False, index=True)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)  # Original filename for display
    file_size = Column(Integer, nullable=True)  # bytes
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="attachments")


class PracticeJournal(Base):
    __tablename__ = "practice_journals"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    attachment_url = Column(String, nullable=True)  # 사진/파일 첨부
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
