from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class PortfolioCategory(str, enum.Enum):
    MONOLOGUE = "monologue"
    SCENE = "scene"
    IMPROV = "improv"
    AUDITION_PREP = "audition_prep"
    OTHER = "other"


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    video_url = Column(String, nullable=False)
    category = Column(SQLEnum(PortfolioCategory), nullable=False)
    tags = Column(String, nullable=True)  # Comma-separated
    ai_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User", back_populates="portfolios")
    comments = relationship("PortfolioComment", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioComment(Base):
    __tablename__ = "portfolio_comments"

    id = Column(String, primary_key=True, index=True)
    portfolio_id = Column(String, ForeignKey("portfolios.id"), nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="comments")
    author = relationship("User", back_populates="portfolio_comments")
