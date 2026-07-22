"""v2 게이미피케이션 라우터 — 박수·커튼콜. 지급 로직은 services.gamify(서버 최종 권위)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.models.gamification import Streak
from app.utils.auth import get_current_user
from app.services import gamify

router = APIRouter()


@router.get("/me")
def my_gamification(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """홈 히어로 대시보드용 — 박수 잔고/오늘치·커튼콜."""
    sid = current_user.id
    streak = db.query(Streak).filter(Streak.student_id == sid).first()
    return {
        "claps_balance": gamify.balance(db, sid),
        "claps_today": gamify.today_earned(db, sid),
        "daily_cap": gamify.DAILY_CAP,
        "streak_days": streak.current if streak else 0,
        "streak_longest": streak.longest if streak else 0,
        "freezes": streak.freezes if streak else 0,
    }


class AwardRequest(BaseModel):
    reason: str
    amount: int
    ref: Optional[str] = None


@router.post("/award")
def award(data: AwardRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """완료 행동 → 박수 지급(일일 상한) + 커튼콜 + 활동 갱신. 서버 최종 권위."""
    sid = current_user.id
    granted, streak_days = gamify.record_action(db, sid, data.reason, data.amount, data.ref)
    db.commit()
    return {
        "granted": granted,
        "claps_today": gamify.today_earned(db, sid),
        "claps_balance": gamify.balance(db, sid),
        "streak_days": streak_days,
    }
