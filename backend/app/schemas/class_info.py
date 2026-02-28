from pydantic import BaseModel
from typing import List, Optional


class ClassInfoBase(BaseModel):
    name: str
    description: str
    schedule: str


class ClassInfoCreate(ClassInfoBase):
    teacher_id: str
    student_ids: List[str] = []


class ClassInfoUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    student_ids: Optional[List[str]] = None


class ClassInfoResponse(ClassInfoBase):
    id: str
    teacher_id: str
    student_ids: List[str]

    class Config:
        from_attributes = True
