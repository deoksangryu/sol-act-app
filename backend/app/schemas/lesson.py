from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.models.lesson import LessonStatus, LessonType


class LessonCreate(BaseModel):
    class_id: str
    date: date
    start_time: str
    end_time: str
    lesson_type: LessonType = LessonType.REGULAR
    location: Optional[str] = None
    memo: Optional[str] = None


class BulkLessonCreate(BaseModel):
    class_id: str
    start_date: date
    end_date: date
    weekdays: List[int]  # 0=Mon, 1=Tue, ..., 6=Sun
    start_time: str
    end_time: str
    lesson_type: LessonType = LessonType.REGULAR
    location: Optional[str] = None


class LessonUpdate(BaseModel):
    date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[LessonStatus] = None
    lesson_type: Optional[LessonType] = None
    location: Optional[str] = None
    memo: Optional[str] = None


class LessonResponse(BaseModel):
    id: str
    class_id: str
    class_name: str
    date: date
    start_time: str
    end_time: str
    status: LessonStatus
    lesson_type: LessonType
    location: Optional[str] = None
    memo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
