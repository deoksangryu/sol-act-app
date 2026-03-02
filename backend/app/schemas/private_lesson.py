from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.lesson import Subject
from app.models.private_lesson import RequestStatus


class PrivateLessonRequestCreate(BaseModel):
    teacher_id: str
    subject: Subject
    preferred_date: str  # YYYY-MM-DD
    preferred_start_time: str  # HH:mm
    preferred_end_time: str  # HH:mm
    reason: str


class PrivateLessonRequestRespond(BaseModel):
    status: RequestStatus  # approved or rejected
    response_note: Optional[str] = None


class PrivateLessonRequestResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    teacher_id: str
    teacher_name: str
    subject: Subject
    preferred_date: str
    preferred_start_time: str
    preferred_end_time: str
    reason: str
    status: RequestStatus
    response_note: Optional[str] = None
    created_at: datetime
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True
