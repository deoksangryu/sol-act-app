from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.lesson import Subject


class ScoresCreate(BaseModel):
    acting: int = Field(ge=1, le=5)
    expression: int = Field(ge=1, le=5)
    creativity: int = Field(ge=1, le=5)
    teamwork: int = Field(ge=1, le=5)
    effort: int = Field(ge=1, le=5)


class ScoresResponse(BaseModel):
    acting: int
    expression: int
    creativity: int
    teamwork: int
    effort: int


class EvaluationCreate(BaseModel):
    student_id: str
    class_id: str
    subject: Subject = Subject.ACTING
    period: str
    scores: ScoresCreate
    comment: Optional[str] = None


class EvaluationUpdate(BaseModel):
    subject: Optional[Subject] = None
    scores: Optional[ScoresCreate] = None
    comment: Optional[str] = None


class EvaluationResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    evaluator_id: str
    evaluator_name: str
    class_id: str
    class_name: str
    subject: Subject
    period: str
    scores: ScoresResponse
    comment: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
