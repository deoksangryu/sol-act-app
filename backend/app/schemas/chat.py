from pydantic import BaseModel
from datetime import datetime


class ChatMessageBase(BaseModel):
    content: str


class ChatMessageCreate(ChatMessageBase):
    class_id: str
    sender_id: str


class ChatMessageResponse(ChatMessageBase):
    id: str
    class_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    avatar: str
    timestamp: datetime

    class Config:
        from_attributes = True
