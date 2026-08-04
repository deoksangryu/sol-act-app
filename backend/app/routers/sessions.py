"""연습 세션 — 타이머/음악재생 시간 기록 + 30분당 +10👏. 월누적/지난달 대비(과거의 나만)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User
from app.models.practice_session import PracticeSession
from app.utils.auth import get_current_user
from app.services import gamify
from app.utils.timezone import today_kst, kst_month_start_utc, kst_day_start_utc

router = APIRouter()

TIMER_REWARD_PER_30MIN = 10


def _month_start(d: date) -> datetime:
    return datetime(d.year, d.month, 1)


def _month_seconds(db: Session, sid: str, start: datetime, end: datetime) -> int:
    return int(db.query(func.coalesce(func.sum(PracticeSession.seconds), 0)).filter(
        PracticeSession.student_id == sid,
        PracticeSession.created_at >= start, PracticeSession.created_at < end,
    ).scalar() or 0)


class LogSession(BaseModel):
    seconds: int
    source: Optional[str] = "timer"
    ref: Optional[str] = None


@router.post("/log")
def log_session(data: LogSession, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """세션 종료 시 호출 — 초 기록 + 30분당 박수(서버권위)."""
    sid = current_user.id
    secs = max(0, min(int(data.seconds), 4 * 3600))  # 단일 세션 최대 4시간으로 제한(위조된 큰 값 차단)
    db.add(PracticeSession(id=f"ps{uuid.uuid4().hex[:12]}", student_id=sid, seconds=secs, source=(data.source or "timer"), ref=data.ref))
    reward = (secs // 1800) * TIMER_REWARD_PER_30MIN
    granted = 0
    if reward > 0:
        db.query(User).filter(User.id == sid).with_for_update().first()  # 행 잠금: 동시 요청 캡 초과·이중지급 방지
        granted, _ = gamify.record_action(db, sid, "timer", reward, ref=data.ref)
    else:
        gamify.touch_activity(db, sid)
    db.commit()
    mstart = kst_month_start_utc()  # 이번 달 = 한국 달력 기준
    return {"granted": granted, "month_seconds": _month_seconds(db, sid, mstart, datetime.utcnow())}


@router.get("/today")
def today_seconds(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """연습 타이머 초기값 — 오늘(한국 달력) 누적 연습 초. 미연습이면 0."""
    sid = current_user.id
    tstart = kst_day_start_utc()
    return {"today_seconds": _month_seconds(db, sid, tstart, datetime.utcnow())}


@router.get("/summary")
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """홈 히어로 — 이번 달 연습 + 지난달 대비(과거의 나만)."""
    sid = current_user.id
    today = today_kst()
    mstart = kst_month_start_utc(today)
    last_month = date(today.year - 1, 12, 1) if today.month == 1 else date(today.year, today.month - 1, 1)
    last_start = kst_month_start_utc(last_month)
    this_m = _month_seconds(db, sid, mstart, datetime.utcnow())
    last_m = _month_seconds(db, sid, last_start, mstart)
    return {"month_seconds": this_m, "last_month_seconds": last_m}
