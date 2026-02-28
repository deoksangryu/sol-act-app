from pydantic import BaseModel
from datetime import datetime
from app.models.notification import NotificationType


class NotificationBase(BaseModel):
    type: NotificationType
    message: str


class NotificationCreate(NotificationBase):
    user_id: str


class NotificationUpdate(BaseModel):
    read: bool


class NotificationResponse(NotificationBase):
    id: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
        # Map created_at to "date" for frontend compatibility
        populate_by_name = True
