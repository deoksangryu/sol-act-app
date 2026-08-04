"""교환소 — 박수 사용. 서버가 잔고 차감(spend_points). 빈 상품표는 lazy-seed."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.user import User
from app.models.exchange import ExchangeItem, ExchangeOrder
from app.models.gamification import Streak
from app.utils.auth import get_current_user
from app.services import gamify
from app.services.notification_service import notify_users, get_teacher_ids_for_student

router = APIRouter()

_SEED = [
    {"name": "선생님 1:1 피드백권", "description": "원하는 영상에 심화 피드백", "cost": 50, "icon": "💬", "kind": "feedback"},
    {"name": "연습실 우선 예약", "description": "이번 주 연습실 우선권", "cost": 40, "icon": "🚪", "kind": "practice_room"},
    {"name": "모의면접 우선권", "description": "모의면접 순번 우선", "cost": 60, "icon": "🎤", "kind": "mock_interview"},
    {"name": "커튼콜 프리즈", "description": "연속 기록 하루 방어(+1)", "cost": 30, "icon": "🧊", "kind": "freeze"},
]


def _seed(db: Session):
    if db.query(ExchangeItem).count() == 0:
        for i, it in enumerate(_SEED):
            db.add(ExchangeItem(id=f"ex_seed_{i}", sort=i, active=True, **it))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


@router.get("/items")
def items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _seed(db)
    rows = db.query(ExchangeItem).filter(ExchangeItem.active == True).order_by(ExchangeItem.sort.asc()).all()  # noqa: E712
    return {
        "balance": gamify.balance(db, current_user.id),
        "items": [{"id": r.id, "name": r.name, "description": r.description, "cost": r.cost, "icon": r.icon, "kind": r.kind} for r in rows],
    }


class RedeemBody(BaseModel):
    item_id: str


@router.post("/redeem")
async def redeem(body: RedeemBody, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    it = db.query(ExchangeItem).filter(ExchangeItem.id == body.item_id, ExchangeItem.active == True).first()  # noqa: E712
    if not it:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없어요")
    # 동시 이중차감(더블탭·경합) 방지: 학생 행을 잠근 뒤 잔고를 재확인한 상태에서 차감.
    db.query(User).filter(User.id == current_user.id).with_for_update().first()
    ok = gamify.spend_points(db, current_user.id, it.cost, reason=f"exchange:{it.kind}", ref=it.id)
    if not ok:
        raise HTTPException(status_code=400, detail="박수가 부족해요")
    db.add(ExchangeOrder(id=f"eo{uuid.uuid4().hex[:12]}", student_id=current_user.id, item_id=it.id, item_name=it.name, cost=it.cost))
    # 프리즈는 즉시 커튼콜 프리즈 +1 (Streak 행이 없으면 생성 — 차감했는데 미지급되는 일 방지)
    if it.kind == "freeze":
        s = db.query(Streak).filter(Streak.student_id == current_user.id).first()
        if s:
            s.freezes = (s.freezes or 0) + 1
        else:
            db.add(Streak(student_id=current_user.id, current=0, longest=0, freezes=1))
    db.commit()
    if it.kind != "freeze":
        await notify_users(db, get_teacher_ids_for_student(db, current_user.id), f"{current_user.name}님이 '{it.name}'를 교환했어요", entity="exchange")
    return {"ok": True, "balance": gamify.balance(db, current_user.id)}


@router.get("/orders")
def orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ExchangeOrder).filter(ExchangeOrder.student_id == current_user.id).order_by(ExchangeOrder.created_at.desc()).limit(30).all()
    return [{"id": r.id, "item_name": r.item_name, "cost": r.cost, "status": r.status, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
