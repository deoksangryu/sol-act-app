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
import re
import uuid

from app.database import get_db
from app.models.practice import PracticeScript, PracticeDraw, PracticeRequest
from app.models.portfolio import Portfolio
from app.models.user import User, UserRole
from app.utils.auth import get_current_user
from app.schemas.practice import CurrentResponse
from app.services.notification_service import notify_users

router = APIRouter()

COOLDOWN = timedelta(hours=1)
REQUEST_DEDUP = timedelta(hours=12)
UPLOAD_TIMEOUT = timedelta(minutes=30)  # 영상 없는 placeholder가 이 시간 넘으면 '실패'(portfolios와 동일 규칙)
# 괄호 지문(감정·행동 연출) 제거용 — 학생에겐 순수 대사만 노출
_PAREN = re.compile(r"\s*\([^)]*\)\s*")


def _require_student(user: User):
    """제시대사 연습은 학생 전용."""
    if user.role != UserRole.STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="제시대사 연습은 학생만 이용할 수 있어요.")


def _student_view(s: PracticeScript) -> dict:
    """학생 노출용 — 형식 + '순수 대사'만. 괄호 지문(감정/행동 연출)은 제거해
    상황·감정 해석을 학생 몫으로 남긴다(연습 취지). 지문만 있던 줄은 버린다."""
    clean = []
    for ln in (s.script or []):
        text = _PAREN.sub(" ", ln.get("text", "")).strip()
        text = re.sub(r"\s{2,}", " ", text)
        if text:
            clean.append({"speaker": ln.get("speaker", ""), "text": text})
    return {"id": s.id, "type": s.type, "script": clean}


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


def _performance_for(db: Session, uid: str, script_id):
    """현재 제시대사에 이 학생이 올린 연기영상(scripted 포트폴리오)을 찾아 상태와 함께 반환. 없으면 None."""
    if not script_id:
        return None
    p = (
        db.query(Portfolio)
        .filter(Portfolio.student_id == uid, Portfolio.practice_script_id == script_id)
        .order_by(Portfolio.created_at.desc())
        .first()
    )
    if not p:
        return None
    if bool((p.video_url or "").strip()):
        st = "ready"
    else:
        age = (datetime.utcnow() - p.created_at) if p.created_at else timedelta(0)
        st = "uploading" if age < UPLOAD_TIMEOUT else "failed"
    cc = len(p.comments or [])
    return {
        "portfolio_id": p.id,
        "video_url": p.video_url or None,
        "thumbnail_url": p.thumbnail_url,
        "upload_status": st,
        "comment_count": cc,
        "has_feedback": cc > 0,
    }


@router.get("/current", response_model=CurrentResponse)
def get_current(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """현재 받은 제시대사 + 쿨다운 상태. 아직 안 받았으면 current=None, can_draw_new=True."""
    _require_student(current_user)
    latest = _latest_draw(db, current_user.id)
    can_new, remaining, next_at, drawn_at = _cooldown(latest)
    cur = None
    perf = None
    if latest:
        s = db.query(PracticeScript).filter(PracticeScript.id == latest.script_id).first()
        if s:
            cur = _student_view(s)
        perf = _performance_for(db, current_user.id, latest.script_id)
    total, seen = _counts(db, current_user.id)
    return {
        "current": cur,
        "performance": perf,
        "can_draw_new": can_new,
        "cooldown_seconds_remaining": remaining,
        "next_draw_at": next_at,
        "drawn_at": drawn_at,
        "total_scripts": total,
        "seen_count": seen,
        "exhausted": total > 0 and seen >= total,
    }


@router.post("/draw", response_model=CurrentResponse)
def draw(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """새 제시대사 받기 — 1시간 쿨다운, 안 본 것 중 랜덤(다 봤으면 직전 제외 전체에서 랜덤)."""
    _require_student(current_user)
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

    # 다 봤으면 전체에서 랜덤(직전 것만 제외해 바로 같은 게 안 나오게).
    # 단, 활성 대사가 1편뿐이면 제외하면 풀이 비므로 제외하지 않는다.
    if not pick:
        active_count = db.query(PracticeScript).filter(PracticeScript.active.is_(True)).count()
        q2 = db.query(PracticeScript).filter(PracticeScript.active.is_(True))
        if latest and active_count > 1:
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
        "performance": _performance_for(db, current_user.id, pick.id),
        "can_draw_new": False,
        "cooldown_seconds_remaining": int(COOLDOWN.total_seconds()),
        "next_draw_at": rec.drawn_at + COOLDOWN,
        "drawn_at": rec.drawn_at,
        "total_scripts": total,
        "seen_count": seen,
        "exhausted": total > 0 and seen >= total,
    }


@router.post("/request-more")
async def request_more(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """제시대사를 모두 소진한 학생이 새 대사를 요청 → 원장(DIRECTOR)에게 알림.

    12시간 내 같은 요청은 중복 알림하지 않는다(스팸 방지).
    """
    _require_student(current_user)
    # 서버측 소진 검증 — 프론트 가드만으론 API 직접 호출을 못 막는다(GET /current의 exhausted와 동일 규칙).
    total, seen = _counts(db, current_user.id)
    if not (total > 0 and seen >= total):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="제시대사를 모두 연습한 뒤에 요청할 수 있어요.")
    # 12시간 중복방지는 '학생 ID' 기준 — 이름은 학생이 바꿀 수 있어 우회 가능하므로 쓰지 않는다.
    recent = datetime.utcnow() - REQUEST_DEDUP
    already = (
        db.query(PracticeRequest.id)
        .filter(PracticeRequest.student_id == current_user.id, PracticeRequest.created_at >= recent)
        .first()
        is not None
    )
    if not already:
        db.add(PracticeRequest(id=f"preq{uuid.uuid4().hex[:7]}", student_id=current_user.id))
        db.commit()
        directors = [u.id for u in db.query(User).filter(User.role == UserRole.DIRECTOR).all()]
        if directors:
            msg = f"{current_user.name}님이 제시대사를 모두 연습했어요. 새 제시대사를 요청했어요."
            await notify_users(db, directors, msg, entity="practice")
    return {"ok": True, "already": already}


@router.get("/script/{script_id}")
def get_script(script_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """제시대사 원문(괄호 지문 제거된 학생 노출용)을 id로 조회.

    선생·원장이 학생 연기영상을 검토할 때 '어떤 대사를 연기했는지' 맥락을 보기 위함.
    노출 내용은 학생용과 동일(대사+형식)이라 별도 권한 제한은 두지 않는다.
    """
    s = db.query(PracticeScript).filter(PracticeScript.id == script_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="제시대사를 찾을 수 없어요.")
    return _student_view(s)
