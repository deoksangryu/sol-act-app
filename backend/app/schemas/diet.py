from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from app.models.diet import MealType


class DietLogBase(BaseModel):
    meal_type: MealType
    description: str
    date: datetime


class DietLogCreate(DietLogBase):
    student_id: str
    image_url: Optional[str] = None


class DietLogUpdate(BaseModel):
    meal_type: Optional[MealType] = None
    description: Optional[str] = None
    calories: Optional[int] = None
    ai_advice: Optional[str] = None
    teacher_comment: Optional[str] = None
    image_url: Optional[str] = None


class DietLogResponse(DietLogBase):
    id: str
    student_id: str
    student_name: str
    calories: Optional[int] = None
    ai_advice: Optional[str] = None
    teacher_comment: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Weight Log schemas
class WeightLogCreate(BaseModel):
    weight: float
    body_fat: Optional[float] = None
    muscle_mass: Optional[float] = None
    visceral_fat: Optional[int] = None
    date: date
    memo: Optional[str] = None


class WeightLogResponse(BaseModel):
    id: str
    student_id: str
    weight: float
    body_fat: Optional[float] = None
    muscle_mass: Optional[float] = None
    visceral_fat: Optional[int] = None
    date: date
    memo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
