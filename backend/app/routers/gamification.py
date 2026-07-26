"""v2 게이미피케이션 라우터 — 박수·커튼콜. 지급 로직은 services.gamify(서버 최종 권위)."""
from fastapi import APIRouter, Depends, HTTPException
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


# 범용 award가 지급할 수 있는 유일한 사유·금액(서버 신뢰). 다른 완료 행동(퀴즈·시청·타이머·
# 루틴·제출)은 각 도메인 라우터가 서버 권위로 직접 지급하므로 여기 없다. 앱은 오직 'journal'만
# 이 엔드포인트로 보낸다(연습 일지 저장 시 +5). reason 화이트리스트 + 금액 고정으로
# 클라이언트가 임의 reason/amount를 주입해 캡까지 무자격 적립하는 신뢰경계 허점을 막는다.
_AWARD_RULES: dict[str, int] = {"journal": 5}


class AwardRequest(BaseModel):
    reason: str
    amount: int = 0  # 클라 값은 무시 — 서버 고정값 사용(하위호환 위해 필드는 유지)
    ref: Optional[str] = None


@router.post("/award")
def award(data: AwardRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """완료 행동 → 박수 지급(일일 상한) + 커튼콜 + 활동 갱신. 서버 최종 권위.
    신뢰경계: reason은 화이트리스트만 허용, amount는 서버 고정값(클라 값 무시)."""
    sid = current_user.id
    reason = (data.reason or "").strip()
    fixed = _AWARD_RULES.get(reason)
    if fixed is None:
        raise HTTPException(status_code=400, detail="허용되지 않은 지급 사유입니다.")
    db.query(User).filter(User.id == sid).with_for_update().first()  # 행 잠금: 동시 탭 중복 지급 방지
    granted, streak_days = gamify.record_action(db, sid, reason, fixed, data.ref)
    db.commit()
    return {
        "granted": granted,
        "claps_today": gamify.today_earned(db, sid),
        "claps_balance": gamify.balance(db, sid),
        "streak_days": streak_days,
    }
