from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.audition import AuditionType, AuditionStatus


class AuditionCreate(BaseModel):
    title: str
    description: str
    date: datetime
    location: Optional[str] = None
    audition_type: AuditionType
    class_id: Optional[str] = None


class AuditionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    location: Optional[str] = None
    status: Optional[AuditionStatus] = None
    audition_type: Optional[AuditionType] = None


class ChecklistCreate(BaseModel):
    content: str
    sort_order: int = 0


class ChecklistUpdate(BaseModel):
    content: Optional[str] = None
    is_checked: Optional[bool] = None
    sort_order: Optional[int] = None


class ChecklistResponse(BaseModel):
    id: str
    content: str
    is_checked: bool
    sort_order: int

    class Config:
        from_attributes = True


class AuditionResponse(BaseModel):
    id: str
    title: str
    description: str
    date: datetime
    location: Optional[str] = None
    audition_type: AuditionType
    status: AuditionStatus
    creator_id: str
    creator_name: str
    class_id: Optional[str] = None
    checklists: List[ChecklistResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
