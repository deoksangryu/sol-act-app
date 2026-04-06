from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.models.lesson import LessonStatus, LessonType, Subject


class LessonCreate(BaseModel):
    class_id: str
    date: date
    start_time: str
    end_time: str
    lesson_type: LessonType = LessonType.REGULAR
    subject: Subject = Subject.ACTING
    teacher_id: Optional[str] = None
    location: Optional[str] = None
    memo: Optional[str] = None
    is_private: bool = False
    private_student_ids: Optional[List[str]] = None
    request_id: Optional[str] = None


class BulkLessonCreate(BaseModel):
    class_id: str
    start_date: date
    end_date: date
    weekdays: List[int]  # 0=Mon, 6=Sun
    start_time: str
    end_time: str
    lesson_type: LessonType = LessonType.REGULAR
    subject: Subject = Subject.ACTING
    teacher_id: Optional[str] = None
    location: Optional[str] = None


class LessonUpdate(BaseModel):
    date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[LessonStatus] = None
    lesson_type: Optional[LessonType] = None
    subject: Optional[Subject] = None
    teacher_id: Optional[str] = None
    location: Optional[str] = None
    memo: Optional[str] = None
    is_private: Optional[bool] = None
    private_student_ids: Optional[List[str]] = None


class LessonResponse(BaseModel):
    id: str
    class_id: Optional[str] = None
    class_name: str
    date: date
    start_time: str
    end_time: str
    status: LessonStatus
    lesson_type: LessonType
    subject: Subject
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    location: Optional[str] = None
    memo: Optional[str] = None
    is_private: bool = False
    private_student_ids: Optional[List[str]] = None
    request_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
