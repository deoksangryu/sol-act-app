from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.portfolio import PortfolioCategory


class PortfolioCreate(BaseModel):
    title: str
    description: str
    video_url: Optional[str] = None
    category: PortfolioCategory
    tags: Optional[str] = None
    practice_group: Optional[str] = None
    video_duration: Optional[int] = None


class PortfolioUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: Optional[str] = None
    category: Optional[PortfolioCategory] = None
    tags: Optional[str] = None


class PortfolioCommentCreate(BaseModel):
    content: str
    timestamp_sec: Optional[int] = None


class PortfolioCommentResponse(BaseModel):
    id: str
    author_id: str
    author_name: str
    content: str
    timestamp_sec: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PracticeJournalCreate(BaseModel):
    content: str
    next_plan: Optional[str] = None


class PracticeJournalResponse(BaseModel):
    id: str
    portfolio_id: str
    author_id: str
    author_name: str
    content: str
    next_plan: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PortfolioResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    title: str
    description: str
    video_url: Optional[str] = None
    category: PortfolioCategory
    tags: Optional[str] = None
    ai_feedback: Optional[str] = None
    practice_group: Optional[str] = None
    video_duration: Optional[int] = None
    comments: List[PortfolioCommentResponse] = []
    practice_journals: List[PracticeJournalResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
