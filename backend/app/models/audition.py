from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class AuditionType(str, enum.Enum):
    AUDITION = "audition"
    COMPETITION = "competition"
    PERFORMANCE = "performance"
    WORKSHOP = "workshop"


class AuditionStatus(str, enum.Enum):
    UPCOMING = "upcoming"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Audition(Base):
    __tablename__ = "auditions"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    date = Column(DateTime, nullable=False)
    location = Column(String, nullable=True)
    audition_type = Column(SQLEnum(AuditionType), nullable=False)
    status = Column(SQLEnum(AuditionStatus), default=AuditionStatus.UPCOMING, nullable=False)
    creator_id = Column(String, ForeignKey("users.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=True)  # Shared with class
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", back_populates="auditions")
    class_info = relationship("ClassInfo", back_populates="auditions")
    checklists = relationship("AuditionChecklist", back_populates="audition", cascade="all, delete-orphan",
                              order_by="AuditionChecklist.sort_order")


class AuditionChecklist(Base):
    __tablename__ = "audition_checklists"

    id = Column(String, primary_key=True, index=True)
    audition_id = Column(String, ForeignKey("auditions.id"), nullable=False)
    content = Column(String, nullable=False)
    is_checked = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    # Relationships
    audition = relationship("Audition", back_populates="checklists")
