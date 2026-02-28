from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.portfolio import PortfolioCategory


class PortfolioCreate(BaseModel):
    title: str
    description: str
    video_url: str
    category: PortfolioCategory
    tags: Optional[str] = None


class PortfolioUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: Optional[str] = None
    category: Optional[PortfolioCategory] = None
    tags: Optional[str] = None


class PortfolioCommentCreate(BaseModel):
    content: str


class PortfolioCommentResponse(BaseModel):
    id: str
    author_id: str
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class PortfolioResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    title: str
    description: str
    video_url: str
    category: PortfolioCategory
    tags: Optional[str] = None
    ai_feedback: Optional[str] = None
    comments: List[PortfolioCommentResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
