"""통합 제출 인박스 + 리드타임 — 제품의 심장(제출→인박스→피드백→배너).

학생 제출 → open Submission 생성(+15👏) → 강사 알림. 강사 피드백 → first_feedback_at 확정
→ 리드타임 산출 → done → 학생 알림(홈 배너). 기존 테이블 무접촉, 이 신규 테이블만 사용.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.submission import Submission
from app.utils.auth import get_current_user
from app.services import gamify
from app.services.notification_service import (
    notify_users, notify_user, get_teacher_ids_for_student, get_teacher_student_ids,
)
from app.utils.timezone import kst_day_start_utc

router = APIRouter()

KIND_LABEL = {"recording": "녹음", "video": "영상", "journal": "일지", "diet": "식단", "interview": "면접", "analysis": "작품분석"}
SUBMIT_REWARD = 15


def _ago(dt: datetime) -> str:
    if not dt:
        return ""
    mins = int((datetime.utcnow() - dt).total_seconds() // 60)
    if mins < 1:
        return "방금"
    if mins < 60:
        return f"{mins}분 전"
    if mins < 60 * 24:
        return f"{mins // 60}시간 전"
    return f"{mins // (60 * 24)}일 전"


def _lead(created: datetime, fb: datetime) -> str:
    if not created or not fb:
        return ""
    mins = int((fb - created).total_seconds() // 60)
    if mins < 60:
        return f"{mins}분"
    return f"{mins / 60:.1f}시간"


def _names(db: Session, ids) -> dict:
    if not ids:
        return {}
    rows = db.query(User.id, User.name).filter(User.id.in_(list(ids))).all()
    return {r[0]: r[1] for r in rows}


class CreateSubmission(BaseModel):
    kind: str
    title: str
    note: Optional[str] = None


@router.post("/submit")
async def submit(data: CreateSubmission, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """학생 제출 — open 생성 + 박수 + 강사 인박스 알림."""
    sid = current_user.id
    teachers = get_teacher_ids_for_student(db, sid)
    sub = Submission(
        id=f"sub{uuid.uuid4().hex[:12]}", student_id=sid,
        teacher_id=(teachers[0] if teachers else None),
        kind=data.kind, title=data.title, note=data.note, status="open",
    )
    db.add(sub)
    # 멱등성: 오늘 같은 (학생·종류·제목) 제출이 이미 있으면 레코드는 만들되 포인트는 재지급 안 함(이중 지급 방지)
    today0 = kst_day_start_utc()
    dup = db.query(Submission.id).filter(
        Submission.student_id == sid, Submission.kind == data.kind,
        Submission.title == data.title, Submission.created_at >= today0,
    ).first()
    if dup:
        granted, streak_days = 0, gamify.record_action(db, sid, "submit", 0, ref=sub.id)[1]
    else:
        granted, streak_days = gamify.record_action(db, sid, "submit", SUBMIT_REWARD, ref=sub.id)
    db.commit()
    db.refresh(sub)
    label = KIND_LABEL.get(data.kind, "제출물")
    await notify_users(db, teachers, f"{current_user.name}님이 {label}을 제출했어요", entity="submission")
    return {"id": sub.id, "granted": granted, "streak_days": streak_days}


@router.get("/inbox")
def inbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """강사/원장 통합 미처리 리스트 + 오늘 처리완료(리드타임)."""
    if current_user.role == UserRole.DIRECTOR:
        open_q = db.query(Submission).filter(Submission.status == "open")
        done_q = db.query(Submission).filter(Submission.status == "done", Submission.first_feedback_at.isnot(None))
    elif current_user.role == UserRole.TEACHER:
        student_ids = get_teacher_student_ids(db, current_user.id)
        student_ids.append("__none__")
        open_q = db.query(Submission).filter(Submission.status == "open", Submission.student_id.in_(student_ids))
        done_q = db.query(Submission).filter(Submission.status == "done", Submission.student_id.in_(student_ids), Submission.first_feedback_at.isnot(None))
    else:
        raise HTTPException(status_code=403, detail="강사/원장 전용")

    opens = open_q.order_by(Submission.created_at.desc()).limit(100).all()
    today0 = kst_day_start_utc()  # 오늘 처리완료 = 한국 달력 오늘
    dones = done_q.filter(Submission.first_feedback_at >= today0).order_by(Submission.first_feedback_at.desc()).limit(50).all()
    names = _names(db, {s.student_id for s in opens} | {s.student_id for s in dones})
    return {
        "count": len(opens),
        "open": [{
            "id": s.id, "student": names.get(s.student_id, "학생"), "student_id": s.student_id, "kind": s.kind,
            "title": s.title, "note": s.note, "ago": _ago(s.created_at),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        } for s in opens],
        "done_today": [{
            "id": s.id, "student": names.get(s.student_id, "학생"), "student_id": s.student_id, "kind": s.kind,
            "title": s.title, "lead": _lead(s.created_at, s.first_feedback_at),
        } for s in dones],
    }


@router.get("/inbox/count")
def inbox_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.DIRECTOR:
        n = db.query(Submission).filter(Submission.status == "open").count()
    elif current_user.role == UserRole.TEACHER:
        student_ids = get_teacher_student_ids(db, current_user.id) or ["__none__"]
        n = db.query(Submission).filter(Submission.status == "open", Submission.student_id.in_(student_ids)).count()
    else:
        n = 0
    return {"count": n}


@router.get("/mine")
def mine(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """학생 본인 제출 이력 — 홈 피드백 배너 소스(최근 피드백 완료분)."""
    subs = db.query(Submission).filter(Submission.student_id == current_user.id).order_by(Submission.created_at.desc()).limit(30).all()
    return [{
        "id": s.id, "kind": s.kind, "title": s.title, "status": s.status,
        "feedback": s.feedback, "ago": _ago(s.created_at),
        "feedback_ago": _ago(s.first_feedback_at) if s.first_feedback_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in subs]


class FeedbackBody(BaseModel):
    feedback: str


@router.post("/{sub_id}/feedback")
async def send_feedback(sub_id: str, body: FeedbackBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """강사 피드백 전송 — 리드타임 확정 + done + 학생 홈 배너."""
    if current_user.role not in (UserRole.TEACHER, UserRole.DIRECTOR):
        raise HTTPException(status_code=403, detail="강사/원장 전용")
    sub = db.query(Submission).filter(Submission.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="제출물을 찾을 수 없어요")
    if current_user.role == UserRole.TEACHER and sub.student_id not in get_teacher_student_ids(db, current_user.id):
        raise HTTPException(status_code=403, detail="담당 학생의 제출물만 첨삭할 수 있어요.")
    if sub.first_feedback_at is None:
        sub.first_feedback_at = datetime.utcnow()
    sub.feedback = body.feedback
    sub.status = "done"
    if not sub.teacher_id:
        sub.teacher_id = current_user.id
    db.commit()
    lead = _lead(sub.created_at, sub.first_feedback_at)
    await notify_user(db, sub.student_id, f"{current_user.name} 선생님의 피드백이 도착했어요", entity="feedback")
    return {"id": sub.id, "status": sub.status, "lead": lead}
