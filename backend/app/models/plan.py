from sqlalchemy import (
    Column, String, Text, DateTime, Integer, Date, Boolean,
    ForeignKey, Enum as SQLEnum, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, date, timedelta
import enum


class PlanType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"


def week_start(d: date) -> date:
    """그 주의 월요일(weekday: 월=0). 주간계획 날짜 정규화에 사용."""
    return d - timedelta(days=d.weekday())


class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = (
        # 학생·타입·날짜당 한 계획(업서트)
        UniqueConstraint("student_id", "plan_type", "plan_date", name="uq_plan_student_type_date"),
    )

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    plan_type = Column(SQLEnum(PlanType), nullable=False)
    plan_date = Column(Date, nullable=False, index=True)  # DAILY=그날 / WEEKLY=그 주 월요일
    teacher_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User")
    items = relationship(
        "PlanItem",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanItem.sort_order",
    )


class PlanItem(Base):
    __tablename__ = "plan_items"

    id = Column(String, primary_key=True, index=True)
    plan_id = Column(String, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    done = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    plan = relationship("Plan", back_populates="items")
