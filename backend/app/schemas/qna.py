from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class AnswerBase(BaseModel):
    content: str


class AnswerCreate(AnswerBase):
    pass


class AnswerResponse(AnswerBase):
    id: str
    author_name: str
    author_role: str
    is_ai: bool
    created_at: datetime

    class Config:
        from_attributes = True
        # Map created_at to "date" for frontend compatibility
        populate_by_name = True


class QuestionBase(BaseModel):
    title: str
    content: str


class QuestionCreate(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    id: str
    author_id: str
    author_name: str
    views: int
    created_at: datetime
    answers: List[AnswerResponse] = []

    class Config:
        from_attributes = True
