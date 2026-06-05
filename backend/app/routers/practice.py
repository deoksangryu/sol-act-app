"""제시대사 연습 — 학생이 1시간에 한 번, 안 본 대사를 랜덤으로 받는다.

설계:
- 미리 만든 풀(practice_scripts)에서 학생이 아직 안 본 것 중 랜덤 1개를 뽑아준다(중복 방지).
- 한 번 받으면 1시간 쿨다운(그 사이 GET /current는 받은 대사를 계속 보여준다).
- 학생에겐 '대사(script)'와 형식(독백/2인)만 노출 — 상황·감정·연기포인트는 숨겨서 직접 분석하게 한다.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.practice import PracticeScript, PracticeDraw
from app.models.user import User
from app.utils.auth import get_current_user
from app.schemas.practice import CurrentResponse

router = APIRouter()

COOLDOWN = timedelta(hours=1)


def _student_view(s: PracticeScript) -> dict:
    """학생 노출용 — 대사와 형식만."""
    return {"id": s.id, "type": s.type, "script": s.script}


def _latest_draw(db: Session, uid: str):
    return (
        db.query(PracticeDraw)
        .filter(PracticeDraw.student_id == uid)
        .order_by(PracticeDraw.drawn_at.desc())
        .first()
    )


def _cooldown(latest):
    """(can_draw_new, remaining_sec, next_draw_at, drawn_at) 계산."""
    now = datetime.utcnow()
    if not latest:
        return True, 0, None, None
    elapsed = now - latest.drawn_at
    if elapsed >= COOLDOWN:
        return True, 0, None, latest.drawn_at
    remaining = int((COOLDOWN - elapsed).total_seconds())
    return False, remaining, latest.drawn_at + COOLDOWN, latest.drawn_at


def _counts(db: Session, uid: str):
    total = db.query(PracticeScript).filter(PracticeScript.active.is_(True)).count()
    seen = (
        db.query(PracticeDraw.script_id)
        .filter(PracticeDraw.student_id == uid)
        .distinct()
        .count()
    )
    return total, seen


@router.get("/current", response_model=CurrentResponse)
def get_current(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """현재 받은 제시대사 + 쿨다운 상태. 아직 안 받았으면 current=None, can_draw_new=True."""
    latest = _latest_draw(db, current_user.id)
    can_new, remaining, next_at, drawn_at = _cooldown(latest)
    cur = None
    if latest:
        s = db.query(PracticeScript).filter(PracticeScript.id == latest.script_id).first()
        if s:
            cur = _student_view(s)
    total, seen = _counts(db, current_user.id)
    return {
        "current": cur,
        "can_draw_new": can_new,
        "cooldown_seconds_remaining": remaining,
        "next_draw_at": next_at,
        "drawn_at": drawn_at,
        "total_scripts": total,
        "seen_count": seen,
    }


@router.post("/draw", response_model=CurrentResponse)
def draw(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """새 제시대사 받기 — 1시간 쿨다운, 안 본 것 중 랜덤(다 봤으면 직전 제외 전체에서 랜덤)."""
    latest = _latest_draw(db, current_user.id)
    can_new, remaining, _, _ = _cooldown(latest)
    if not can_new:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"다음 제시대사는 {remaining // 60}분 {remaining % 60}초 후에 받을 수 있어요.",
        )

    # 이 학생이 이미 본 대사 제외
    seen_ids = [
        r[0] for r in db.query(PracticeDraw.script_id)
        .filter(PracticeDraw.student_id == current_user.id).distinct().all()
    ]
    q = db.query(PracticeScript).filter(PracticeScript.active.is_(True))
    if seen_ids:
        q = q.filter(PracticeScript.id.notin_(seen_ids))
    pick = q.order_by(func.random()).first()

    # 다 봤으면 전체에서 랜덤(직전 것만 제외해 바로 같은 게 안 나오게)
    if not pick:
        q2 = db.query(PracticeScript).filter(PracticeScript.active.is_(True))
        if latest:
            q2 = q2.filter(PracticeScript.id != latest.script_id)
        pick = q2.order_by(func.random()).first()
    if not pick:
        raise HTTPException(status_code=404, detail="아직 제시대사가 없어요.")

    rec = PracticeDraw(
        id=f"draw{uuid.uuid4().hex[:7]}",
        student_id=current_user.id,
        script_id=pick.id,
        drawn_at=datetime.utcnow(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    total, seen = _counts(db, current_user.id)
    return {
        "current": _student_view(pick),
        "can_draw_new": False,
        "cooldown_seconds_remaining": int(COOLDOWN.total_seconds()),
        "next_draw_at": rec.drawn_at + COOLDOWN,
        "drawn_at": rec.drawn_at,
        "total_scripts": total,
        "seen_count": seen,
    }
