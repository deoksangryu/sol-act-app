from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class ScheduleSlot(BaseModel):
    day: str          # '월' | '화' | '수' | '목' | '금' | '토' | '일'
    start_time: str   # 'HH:mm'
    end_time: str     # 'HH:mm'


class ClassInfoBase(BaseModel):
    name: str
    description: str
    schedule: List[ScheduleSlot] = []


class ClassInfoCreate(ClassInfoBase):
    subject_teachers: Dict[str, str] = {}  # {"acting": "t1", "musical": "t2"}
    student_ids: List[str] = []


class ClassInfoUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[List[ScheduleSlot]] = None
    subject_teachers: Optional[Dict[str, str]] = None
    student_ids: Optional[List[str]] = None


class ClassInfoResponse(BaseModel):
    id: str
    name: str
    description: str
    schedule: Any  # List[ScheduleSlot] or legacy string
    subject_teachers: Dict[str, str]
    student_ids: List[str]
    generated_lessons_count: Optional[int] = None

    class Config:
        from_attributes = True
