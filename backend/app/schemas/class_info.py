from pydantic import BaseModel
from typing import List, Optional, Dict


class ClassInfoBase(BaseModel):
    name: str
    description: str
    schedule: str


class ClassInfoCreate(ClassInfoBase):
    subject_teachers: Dict[str, str] = {}  # {"acting": "t1", "musical": "t2"}
    student_ids: List[str] = []


class ClassInfoUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    subject_teachers: Optional[Dict[str, str]] = None
    student_ids: Optional[List[str]] = None


class ClassInfoResponse(ClassInfoBase):
    id: str
    subject_teachers: Dict[str, str]
    student_ids: List[str]

    class Config:
        from_attributes = True
