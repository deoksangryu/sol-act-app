"""오늘의 미션 — 학원 공용(원장 관리). 앱 홈이 /missions/today 응답을 렌더하므로 DB만 바꾸면 반영(재배포 X).

type이 완료판정·이동을 결정: video(영상 제출) / journal(연습 일지) / quiz(상식 퀴즈).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.mission import Mission
from app.utils.auth import get_current_user

router = APIRouter()

_TYPES = ("video", "journal", "quiz")
DEFAULTS = [
    {"type": "video", "title": "연기 영상 1개 제출", "sub": "오늘 연습을 영상으로 남겨요", "reward": 15},
    {"type": "quiz", "title": "오늘의 상식 퀴즈", "sub": "연극사 · 1문제", "reward": 5},
    {"type": "journal", "title": "연습 일지 쓰기", "sub": "오늘 잘된 점 한 줄이면 충분해요", "reward": 5},
]


def _require_director(user: User) -> None:
    if user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 미션을 관리할 수 있어요.")


def _seed(db: Session):
    if db.query(Mission).count() == 0:
        for i, d in enumerate(DEFAULTS):
            db.add(Mission(id=f"ms_seed_{i}", sort=i, active=True, **d))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


@router.get("/today")
def today(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed(db)
    rows = db.query(Mission).filter(Mission.active == True).order_by(Mission.sort.asc(), Mission.id.asc()).all()  # noqa: E712
    return [{"id": r.id, "type": r.type, "title": r.title, "sub": r.sub, "reward": r.reward} for r in rows]


# ── 원장 미션 관리(CRUD) ──
class MissionIn(BaseModel):
    type: str = "video"     # video | journal | quiz
    title: str
    sub: Optional[str] = ""
    reward: int = 5


def _apply(m: Mission, body: MissionIn):
    if not (body.title or "").strip():
        raise HTTPException(status_code=400, detail="미션 제목을 입력해주세요.")
    t = (body.type or "video").strip()
    if t not in _TYPES:
        raise HTTPException(status_code=400, detail="미션 종류는 video·journal·quiz 중 하나예요.")
    m.type = t
    m.title = body.title.strip()
    m.sub = (body.sub or "").strip() or None
    m.reward = max(0, min(99, int(body.reward or 5)))


@router.get("/admin")
def admin_list(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    _seed(db)
    rows = db.query(Mission).order_by(Mission.sort.asc(), Mission.id.asc()).all()
    return [{"id": r.id, "type": r.type, "title": r.title, "sub": r.sub, "reward": r.reward, "active": r.active} for r in rows]


@router.post("/admin")
def admin_create(body: MissionIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    m = Mission(id=f"ms{uuid.uuid4().hex[:10]}", type="video", title="", reward=5, active=True, sort=db.query(Mission).count())
    _apply(m, body)
    db.add(m); db.commit()
    return {"id": m.id}


@router.put("/admin/{mission_id}")
def admin_update(mission_id: str, body: MissionIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="미션을 찾을 수 없어요.")
    _apply(m, body); db.commit()
    return {"ok": True}


@router.delete("/admin/{mission_id}")
def admin_delete(mission_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if m:
        db.delete(m); db.commit()
    return {"ok": True}
