from pydantic import BaseModel
from typing import Optional
from datetime import datetime
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
    image_url: Optional[str] = None


class DietLogResponse(DietLogBase):
    id: str
    student_id: str
    student_name: str
    calories: Optional[int] = None
    ai_advice: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
