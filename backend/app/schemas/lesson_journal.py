from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date, datetime
from app.models.lesson_journal import JournalType


class MediaItem(BaseModel):
    url: str
    name: str


class LessonJournalCreate(BaseModel):
    lesson_id: str
    journal_type: JournalType
    content: str
    objectives: Optional[str] = None
    next_plan: Optional[str] = None
    media_urls: Optional[List[Any]] = None  # str or {url, name}


class LessonJournalUpdate(BaseModel):
    content: Optional[str] = None
    objectives: Optional[str] = None
    next_plan: Optional[str] = None
    ai_feedback: Optional[str] = None
    media_urls: Optional[List[Any]] = None  # str or {url, name}


class LessonJournalResponse(BaseModel):
    id: str
    lesson_id: str
    author_id: str
    author_name: str
    journal_type: JournalType
    content: str
    objectives: Optional[str] = None
    next_plan: Optional[str] = None
    ai_feedback: Optional[str] = None
    media_urls: Optional[List[Any]] = None  # [{url, name}, ...]
    lesson_date: date
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
