"""시험 일정 / D-day — 원장 입력, 전 학생 홈 즉시 반영 + 알림."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.exam import ExamSchedule
from app.utils.auth import get_current_user
from app.services.notification_service import notify_users, get_all_student_ids
from app.utils.timezone import today_kst

router = APIRouter()


def _dday(exam_date: date) -> int:
    return (exam_date - today_kst()).days  # D-day는 한국 날짜 기준


def _serialize(e: ExamSchedule) -> dict:
    return {
        "id": e.id, "title": e.title,
        "exam_date": e.exam_date.isoformat() if e.exam_date else None,
        "note": e.note, "dday": _dday(e.exam_date) if e.exam_date else None,
    }


@router.get("/list")
def list_exams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """등록된 시험 일정 — 다가오는 순. 학생·강사·원장 모두 R."""
    exams = db.query(ExamSchedule).order_by(ExamSchedule.exam_date.asc()).all()
    today = today_kst()
    upcoming = [e for e in exams if e.exam_date and e.exam_date >= today]
    past = [e for e in exams if e.exam_date and e.exam_date < today]
    return [_serialize(e) for e in upcoming] + [_serialize(e) for e in past]


@router.get("/dday")
def nearest_dday(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """홈 D-day 칩 — 최근접 시험."""
    today = today_kst()
    e = db.query(ExamSchedule).filter(ExamSchedule.exam_date >= today).order_by(ExamSchedule.exam_date.asc()).first()
    if not e:
        return {"exam": None}
    return {"exam": _serialize(e)}


class CreateExam(BaseModel):
    title: str
    exam_date: str  # YYYY-MM-DD
    note: Optional[str] = None


@router.post("/create")
async def create_exam(data: CreateExam, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장 전용")
    try:
        ed = datetime.strptime(data.exam_date.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 예: 2026-10-11")
    e = ExamSchedule(id=f"ex{uuid.uuid4().hex[:12]}", title=data.title.strip(), exam_date=ed, note=data.note, created_by=current_user.id)
    db.add(e)
    db.commit()
    db.refresh(e)
    await notify_users(db, get_all_student_ids(db), f"새 시험 일정: {e.title} (D-{max(0, _dday(ed))})", entity="exam")
    return _serialize(e)


@router.delete("/{exam_id}")
def delete_exam(exam_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장 전용")
    e = db.query(ExamSchedule).filter(ExamSchedule.id == exam_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없어요")
    db.delete(e)
    db.commit()
    return {"ok": True}
