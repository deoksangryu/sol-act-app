"""오늘의 루틴 — 학생별 체크리스트. 최초 GET 때 기본 3항목 lazy-seed, 체크 시 +N👏."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date
import uuid

from app.database import get_db
from app.models.user import User
from app.models.routine import RoutineItem, RoutineCompletion
from app.utils.auth import get_current_user
from app.services import gamify
from app.utils.timezone import today_kst

router = APIRouter()

DEFAULTS = [
    {"title": "발성 루틴 10분", "sub": "아침 워밍업", "reward": 10},
    {"title": "전신 스트레칭", "sub": "무용 전 부상 방지", "reward": 5},
    {"title": "복식호흡 5분", "sub": "타이머와 함께", "reward": 5},
]


def _seed(db: Session, sid: str):
    if db.query(RoutineItem).filter(RoutineItem.student_id == sid).count() == 0:
        for i, d in enumerate(DEFAULTS):
            db.add(RoutineItem(id=f"rt_{sid}_{i}", student_id=sid, sort=i, active=True, **d))  # 고정 PK: 동시요청 중복 방지
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # 다른 요청이 먼저 시드함 — 정상


@router.get("/today")
def today(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sid = current_user.id
    _seed(db, sid)
    items = db.query(RoutineItem).filter(RoutineItem.student_id == sid, RoutineItem.active == True).order_by(RoutineItem.sort.asc()).all()  # noqa: E712
    done_ids = {r[0] for r in db.query(RoutineCompletion.item_id).filter(RoutineCompletion.student_id == sid, RoutineCompletion.date == today_kst()).all()}
    out = [{"id": it.id, "title": it.title, "sub": it.sub, "reward": it.reward, "done": it.id in done_ids} for it in items]
    return {"items": out, "done_count": sum(1 for x in out if x["done"]), "total": len(out)}


@router.post("/{item_id}/check")
def check(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sid = current_user.id
    it = db.query(RoutineItem).filter(RoutineItem.id == item_id, RoutineItem.student_id == sid).first()
    if not it:
        raise HTTPException(status_code=404, detail="루틴을 찾을 수 없어요")
    today_d = today_kst()
    db.query(User).filter(User.id == sid).with_for_update().first()  # 행 잠금: 동시 탭 중복 지급 방지
    already = db.query(RoutineCompletion).filter(
        RoutineCompletion.student_id == sid, RoutineCompletion.item_id == item_id, RoutineCompletion.date == today_d,
    ).first()
    granted = 0
    if not already:
        db.add(RoutineCompletion(id=f"rc{uuid.uuid4().hex[:10]}", student_id=sid, item_id=item_id, date=today_d))
        granted, _ = gamify.record_action(db, sid, "routine", it.reward, ref=item_id)
    db.commit()
    done_count = db.query(RoutineCompletion).filter(RoutineCompletion.student_id == sid, RoutineCompletion.date == today_d).count()
    return {"granted": granted, "done_count": done_count}
