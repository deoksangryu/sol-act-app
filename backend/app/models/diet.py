from sqlalchemy import Column, String, Text, DateTime, Integer, Date, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class MealType(str, enum.Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class DietLog(Base):
    __tablename__ = "diet_logs"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    meal_type = Column(SQLEnum(MealType), nullable=False)
    description = Column(Text, nullable=False)
    calories = Column(Integer, nullable=True)
    ai_advice = Column(Text, nullable=True)
    teacher_comment = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User", back_populates="diet_logs")


class WeightLog(Base):
    __tablename__ = "weight_logs"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    weight = Column(Float, nullable=False)  # kg
    body_fat = Column(Float, nullable=True)  # 체지방률 %
    muscle_mass = Column(Float, nullable=True)  # 근육량 kg
    visceral_fat = Column(Integer, nullable=True)  # 내장지방레벨
    date = Column(Date, nullable=False, index=True)
    memo = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User")
