from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PraiseStickerCreate(BaseModel):
    recipient_id: str
    emoji: str
    message: str


class PraiseStickerResponse(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    recipient_id: str
    recipient_name: str
    emoji: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True
