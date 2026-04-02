from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.assignment import AssignmentStatus


class AssignmentBase(BaseModel):
    title: str
    description: str
    due_date: datetime


class AssignmentCreate(AssignmentBase):
    student_id: Optional[str] = None       # single student
    student_ids: Optional[List[str]] = None  # bulk: multiple students or class
    class_id: Optional[str] = None          # bulk: assign to entire class
    attachment_url: Optional[str] = None    # teacher-attached file URL


class AssignmentUpdate(BaseModel):
    submission_text: Optional[str] = None
    submission_file_url: Optional[str] = None
    feedback: Optional[str] = None
    ai_analysis: Optional[str] = None
    grade: Optional[str] = None
    status: Optional[AssignmentStatus] = None


class AssignmentResponse(AssignmentBase):
    id: str
    student_id: str
    student_name: str
    status: AssignmentStatus
    attachment_url: Optional[str] = None
    submission_text: Optional[str] = None
    submission_file_url: Optional[str] = None
    feedback: Optional[str] = None
    ai_analysis: Optional[str] = None
    grade: Optional[str] = None
    assigned_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
