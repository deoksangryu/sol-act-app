from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.utils.auth import get_current_user
from app.models.user import User, UserRole
from app.models.praise_sticker import PraiseSticker
from app.schemas.praise_sticker import PraiseStickerCreate, PraiseStickerResponse
from app.models.notification import NotificationType
from app.services.notification_service import notify_user
import uuid

router = APIRouter()


def _to_response(sticker: PraiseSticker) -> dict:
    return {
        "id": sticker.id,
        "sender_id": sticker.sender_id,
        "sender_name": sticker.sender.name if sticker.sender else "",
        "recipient_id": sticker.recipient_id,
        "recipient_name": sticker.recipient.name if sticker.recipient else "",
        "emoji": sticker.emoji,
        "message": sticker.message,
        "created_at": sticker.created_at,
    }


@router.get("/", response_model=List[PraiseStickerResponse])
def list_stickers(
    recipient_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List praise stickers. Students see only their own. Staff can filter by recipient."""
    query = db.query(PraiseSticker)

    if current_user.role == UserRole.STUDENT:
        query = query.filter(PraiseSticker.recipient_id == current_user.id)
    elif recipient_id:
        query = query.filter(PraiseSticker.recipient_id == recipient_id)

    stickers = query.order_by(PraiseSticker.created_at.desc()).offset(skip).limit(limit).all()
    return [_to_response(s) for s in stickers]


@router.post("/", response_model=PraiseStickerResponse)
async def create_sticker(
    data: PraiseStickerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a praise sticker to a student. Staff only."""
    if current_user.role == UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="학생은 스티커를 보낼 수 없습니다.")

    # Validate recipient is a student
    recipient = db.query(User).filter(User.id == data.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다.")
    if recipient.role != UserRole.STUDENT:
        raise HTTPException(status_code=400, detail="학생에게만 스티커를 보낼 수 있습니다.")

    sticker = PraiseSticker(
        id=f"stk{uuid.uuid4().hex[:8]}",
        sender_id=current_user.id,
        recipient_id=data.recipient_id,
        emoji=data.emoji,
        message=data.message,
    )
    db.add(sticker)
    db.commit()
    db.refresh(sticker)

    # Notify the student
    await notify_user(
        db,
        data.recipient_id,
        f"{sticker.emoji} {current_user.name} 선생님이 칭찬스티커를 보냈습니다!",
        notif_type=NotificationType.SUCCESS,
        entity="praise_stickers",
    )

    return _to_response(sticker)


@router.delete("/{sticker_id}")
def delete_sticker(
    sticker_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a praise sticker. Only the sender or director can delete."""
    sticker = db.query(PraiseSticker).filter(PraiseSticker.id == sticker_id).first()
    if not sticker:
        raise HTTPException(status_code=404, detail="스티커를 찾을 수 없습니다.")

    if current_user.role != UserRole.DIRECTOR and sticker.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

    db.delete(sticker)
    db.commit()
    return {"message": "삭제되었습니다."}
