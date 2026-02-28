from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.lesson import Lesson
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceCreate, AttendanceBulkCreate, AttendanceUpdate,
    AttendanceResponse, AttendanceStats
)
from app.utils.auth import get_current_user
import uuid

router = APIRouter()


def attendance_to_response(a: Attendance) -> dict:
    return {
        "id": a.id,
        "lesson_id": a.lesson_id,
        "student_id": a.student_id,
        "student_name": a.student.name if a.student else "",
        "status": a.status,
        "note": a.note,
        "marked_by": a.marked_by,
        "created_at": a.created_at,
    }


@router.get("/", response_model=List[AttendanceResponse])
def list_attendance(
    lesson_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).options(joinedload(Attendance.student))
    if lesson_id:
        query = query.filter(Attendance.lesson_id == lesson_id)
    if student_id:
        query = query.filter(Attendance.student_id == student_id)
    records = query.order_by(Attendance.created_at.desc()).all()
    return [attendance_to_response(a) for a in records]


# /stats and /bulk must be before /{id}
@router.get("/stats", response_model=List[AttendanceStats])
def get_attendance_stats(
    student_id: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Attendance).join(Lesson, Attendance.lesson_id == Lesson.id)
    if student_id:
        query = query.filter(Attendance.student_id == student_id)
    if class_id:
        query = query.filter(Lesson.class_id == class_id)
    if date_from:
        from datetime import datetime
        query = query.filter(Lesson.date >= datetime.strptime(date_from, "%Y-%m-%d").date())
    if date_to:
        from datetime import datetime
        query = query.filter(Lesson.date <= datetime.strptime(date_to, "%Y-%m-%d").date())

    records = query.all()

    # Group by student
    stats_map = {}
    for r in records:
        sid = r.student_id
        if sid not in stats_map:
            student = db.query(User).filter(User.id == sid).first()
            stats_map[sid] = {
                "student_id": sid,
                "student_name": student.name if student else "",
                "total": 0, "present": 0, "late": 0, "absent": 0, "excused": 0,
            }
        stats_map[sid]["total"] += 1
        stats_map[sid][r.status.value] += 1

    result = []
    for sid, s in stats_map.items():
        rate = (s["present"] + s["late"]) / s["total"] * 100 if s["total"] > 0 else 0
        result.append(AttendanceStats(**s, rate=round(rate, 1)))
    return result


@router.post("/bulk", response_model=List[AttendanceResponse], status_code=status.HTTP_201_CREATED)
def bulk_create_attendance(
    data: AttendanceBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lesson = db.query(Lesson).filter(Lesson.id == data.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    created = []
    for record in data.records:
        # Update existing or create new
        existing = db.query(Attendance).filter(
            Attendance.lesson_id == data.lesson_id,
            Attendance.student_id == record.student_id
        ).first()

        if existing:
            existing.status = record.status
            existing.note = record.note
            existing.marked_by = current_user.id
            created.append(existing)
        else:
            att = Attendance(
                id=f"att{uuid.uuid4().hex[:7]}",
                lesson_id=data.lesson_id,
                student_id=record.student_id,
                status=record.status,
                note=record.note,
                marked_by=current_user.id,
            )
            db.add(att)
            created.append(att)

    db.commit()
    result = []
    for att in created:
        db.refresh(att)
        a = db.query(Attendance).options(joinedload(Attendance.student)).filter(Attendance.id == att.id).first()
        result.append(attendance_to_response(a))
    return result


@router.post("/", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def create_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    att = Attendance(
        id=f"att{uuid.uuid4().hex[:7]}",
        lesson_id=data.lesson_id,
        student_id=data.student_id,
        status=data.status,
        note=data.note,
        marked_by=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    a = db.query(Attendance).options(joinedload(Attendance.student)).filter(Attendance.id == att.id).first()
    return attendance_to_response(a)


@router.put("/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(
    attendance_id: str,
    update_data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    a = db.query(Attendance).options(joinedload(Attendance.student)).filter(Attendance.id == attendance_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)
    a.marked_by = current_user.id

    db.commit()
    db.refresh(a)
    return attendance_to_response(a)
