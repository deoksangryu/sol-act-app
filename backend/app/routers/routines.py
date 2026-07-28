"""오늘의 루틴 — 학원 공용 루틴(원장 관리) + 학생별 일자 완료 기록.

- RoutineTemplate: 원장이 관리하는 학원 공용 루틴 목록(모든 학생 공통). DB만 바꾸면 앱에 반영(재배포 X).
- RoutineCompletion: 학생별·일자별 체크 기록(체크 시 +N👏).
- 앱은 /routines/today 응답을 그대로 렌더하므로, 템플릿을 바꾸면 학생 화면이 즉시 달라진다.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.routine import RoutineTemplate, RoutineCompletion
from app.utils.auth import get_current_user
from app.services import gamify
from app.utils.timezone import today_kst

router = APIRouter()

DEFAULTS = [
    {"title": "발성 루틴 10분", "sub": "아침 워밍업", "reward": 10},
    {"title": "전신 스트레칭", "sub": "무용 전 부상 방지", "reward": 5},
    {"title": "복식호흡 5분", "sub": "타이머와 함께", "reward": 5},
]


def _require_director(user: User) -> None:
    if user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 루틴을 관리할 수 있어요.")


def _seed_template(db: Session):
    """공용 루틴이 비어 있으면 기본 3항목을 최초 1회 시드(고정 PK로 동시요청 안전)."""
    if db.query(RoutineTemplate).count() == 0:
        for i, d in enumerate(DEFAULTS):
            db.add(RoutineTemplate(id=f"rt_tpl_{i}", sort=i, active=True, **d))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


@router.get("/today")
def today(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sid = current_user.id
    _seed_template(db)
    items = db.query(RoutineTemplate).filter(RoutineTemplate.active == True).order_by(RoutineTemplate.sort.asc(), RoutineTemplate.id.asc()).all()  # noqa: E712
    done_ids = {r[0] for r in db.query(RoutineCompletion.item_id).filter(RoutineCompletion.student_id == sid, RoutineCompletion.date == today_kst()).all()}
    out = [{"id": it.id, "title": it.title, "sub": it.sub, "reward": it.reward, "done": it.id in done_ids} for it in items]
    return {"items": out, "done_count": sum(1 for x in out if x["done"]), "total": len(out)}


@router.post("/{item_id}/check")
def check(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sid = current_user.id
    it = db.query(RoutineTemplate).filter(RoutineTemplate.id == item_id, RoutineTemplate.active == True).first()  # noqa: E712
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


# ── 원장 루틴 관리(CRUD) ──
class RoutineIn(BaseModel):
    title: str
    sub: Optional[str] = ""
    reward: int = 5


def _apply(it: RoutineTemplate, body: RoutineIn):
    if not (body.title or "").strip():
        raise HTTPException(status_code=400, detail="루틴 이름을 입력해주세요.")
    it.title = body.title.strip()
    it.sub = (body.sub or "").strip() or None
    it.reward = max(0, min(60, int(body.reward or 5)))


@router.get("/admin")
def admin_list(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    _seed_template(db)
    rows = db.query(RoutineTemplate).order_by(RoutineTemplate.sort.asc(), RoutineTemplate.id.asc()).all()
    return [{"id": r.id, "title": r.title, "sub": r.sub, "reward": r.reward, "active": r.active} for r in rows]


@router.post("/admin")
def admin_create(body: RoutineIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    it = RoutineTemplate(id=f"rt{uuid.uuid4().hex[:10]}", title="", reward=5, active=True, sort=db.query(RoutineTemplate).count())
    _apply(it, body)
    db.add(it); db.commit()
    return {"id": it.id}


@router.put("/admin/{item_id}")
def admin_update(item_id: str, body: RoutineIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    it = db.query(RoutineTemplate).filter(RoutineTemplate.id == item_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="루틴을 찾을 수 없어요.")
    _apply(it, body); db.commit()
    return {"ok": True}


@router.delete("/admin/{item_id}")
def admin_delete(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    it = db.query(RoutineTemplate).filter(RoutineTemplate.id == item_id).first()
    if it:
        db.delete(it); db.commit()
    return {"ok": True}
