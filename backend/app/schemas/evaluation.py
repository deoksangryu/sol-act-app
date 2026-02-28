from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EvaluationCreate(BaseModel):
    student_id: str
    class_id: str
    period: str
    acting_skill: int = Field(ge=1, le=5)
    expressiveness: int = Field(ge=1, le=5)
    teamwork: int = Field(ge=1, le=5)
    effort: int = Field(ge=1, le=5)
    attendance_score: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class EvaluationUpdate(BaseModel):
    acting_skill: Optional[int] = Field(None, ge=1, le=5)
    expressiveness: Optional[int] = Field(None, ge=1, le=5)
    teamwork: Optional[int] = Field(None, ge=1, le=5)
    effort: Optional[int] = Field(None, ge=1, le=5)
    attendance_score: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None


class EvaluationResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    evaluator_id: str
    evaluator_name: str
    class_id: str
    class_name: str
    period: str
    acting_skill: int
    expressiveness: int
    teamwork: int
    effort: int
    attendance_score: int
    comment: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
