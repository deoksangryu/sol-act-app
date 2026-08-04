"""갈채 뱃지 — 자동 룰(스트릭·제출·연습) 라이브 평가 + 강사수여(성장상) 수동 발급.

정의는 코드 상수(BADGE_DEFS). 자동 뱃지는 신호로 즉시 판정(별도 저장 불필요),
수동 뱃지(성장상 등)만 user_badges에 저장.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.gamification import Streak
from app.models.submission import Submission
from app.models.practice_session import PracticeSession
from app.models.achievement import UserBadge
from app.utils.auth import get_current_user
from app.services.notification_service import notify_user

router = APIRouter()

# code, title, sub, icon, auto(rule 함수 or None=수동수여)
BADGE_DEFS = [
    {"code": "first_rec", "title": "첫 녹음", "sub": "데뷔 무대", "icon": "🎙️", "auto": lambda c: c["rec"] >= 1},
    {"code": "streak7", "title": "7일 연속", "sub": "커튼콜", "icon": "🔥", "auto": lambda c: c["streak_longest"] >= 7},
    {"code": "submit10", "title": "열정 제출", "sub": "제출 10회", "icon": "📮", "auto": lambda c: c["submits"] >= 10},
    {"code": "practice10h", "title": "연습벌레", "sub": "누적 10시간", "icon": "⏱️", "auto": lambda c: c["practice_sec"] >= 36000},
    {"code": "growth", "title": "성장상", "sub": "선생님 수여", "icon": "🌟", "auto": None},
    {"code": "streak30", "title": "30일 연속", "sub": "커튼콜", "icon": "🎭", "auto": lambda c: c["streak_longest"] >= 30},
    {"code": "seagull_master", "title": "갈매기 마스터", "sub": "독백 완성", "icon": "🕊️", "auto": None},
    {"code": "karts_prep", "title": "한예종 준비생", "sub": "지정희곡 3편", "icon": "🏛️", "auto": None},
    {"code": "streak100", "title": "100일 커튼콜", "sub": "스트릭 100일", "icon": "💯", "auto": lambda c: c["streak_longest"] >= 100},
]
MANUAL_CODES = {b["code"] for b in BADGE_DEFS if b["auto"] is None}


def _ctx(db: Session, sid: str) -> dict:
    streak = db.query(Streak).filter(Streak.student_id == sid).first()
    rec = db.query(Submission).filter(Submission.student_id == sid, Submission.kind == "recording").count()
    submits = db.query(Submission).filter(Submission.student_id == sid).count()
    practice_sec = int(db.query(func.coalesce(func.sum(PracticeSession.seconds), 0)).filter(PracticeSession.student_id == sid).scalar() or 0)
    return {
        "streak_longest": streak.longest if streak else 0,
        "rec": rec, "submits": submits, "practice_sec": practice_sec,
    }


def _owned_map(db: Session, sid: str) -> set:
    return {r[0] for r in db.query(UserBadge.badge_code).filter(UserBadge.student_id == sid).all()}


def _badges_for(db: Session, sid: str) -> dict:
    ctx = _ctx(db, sid)
    manual = _owned_map(db, sid)
    badges = []
    for b in BADGE_DEFS:
        owned = (b["code"] in manual) if b["auto"] is None else bool(b["auto"](ctx))
        badges.append({"code": b["code"], "title": b["title"], "sub": b["sub"], "icon": b["icon"], "owned": owned})
    return {"badges": badges, "owned_count": sum(1 for x in badges if x["owned"]), "total": len(badges)}


@router.get("/me")
def my_badges(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _badges_for(db, current_user.id)


@router.get("/student/{student_id}")
def student_badges(student_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.TEACHER, UserRole.DIRECTOR):
        raise HTTPException(status_code=403, detail="강사/원장 전용")
    return _badges_for(db, student_id)


class GrantBody(BaseModel):
    student_id: str
    code: str = "growth"


@router.post("/grant")
async def grant_badge(body: GrantBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """강사수여(성장상 등) — 수동 뱃지만. 자동 뱃지는 발급 불가."""
    if current_user.role not in (UserRole.TEACHER, UserRole.DIRECTOR):
        raise HTTPException(status_code=403, detail="강사/원장 전용")
    if body.code not in MANUAL_CODES:
        raise HTTPException(status_code=400, detail="자동 뱃지는 수여할 수 없어요")
    exists = db.query(UserBadge).filter(UserBadge.student_id == body.student_id, UserBadge.badge_code == body.code).first()
    if exists:
        return {"ok": True, "already": True}
    db.add(UserBadge(id=f"ub{uuid.uuid4().hex[:12]}", student_id=body.student_id, badge_code=body.code, granted_by=current_user.id))
    db.commit()
    meta = next((b for b in BADGE_DEFS if b["code"] == body.code), None)
    title = meta["title"] if meta else "뱃지"
    await notify_user(db, body.student_id, f"🌟 {title} 갈채를 받았어요!", entity="badge")
    return {"ok": True, "already": False}
