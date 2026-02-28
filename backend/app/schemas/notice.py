from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NoticeBase(BaseModel):
    title: str
    content: str
    important: bool = False


class NoticeCreate(NoticeBase):
    author: str


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    important: Optional[bool] = None


class NoticeResponse(NoticeBase):
    id: str
    author: str
    created_at: datetime

    class Config:
        from_attributes = True
        # Map created_at to "date" for frontend compatibility
        populate_by_name = True
