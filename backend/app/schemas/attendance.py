from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.attendance import AttendanceStatus


class AttendanceCreate(BaseModel):
    lesson_id: str
    student_id: str
    status: AttendanceStatus
    note: Optional[str] = None


class AttendanceRecord(BaseModel):
    student_id: str
    status: AttendanceStatus
    note: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    lesson_id: str
    records: List[AttendanceRecord]


class AttendanceUpdate(BaseModel):
    status: Optional[AttendanceStatus] = None
    note: Optional[str] = None


class AttendanceResponse(BaseModel):
    id: str
    lesson_id: str
    student_id: str
    student_name: str
    status: AttendanceStatus
    note: Optional[str] = None
    marked_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceStats(BaseModel):
    student_id: str
    student_name: str
    total: int
    present: int
    late: int
    absent: int
    excused: int
    rate: float  # Attendance rate (present + late) / total
