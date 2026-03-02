from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Dict
from app.database import get_db
from app.models.chat import ChatMessage, ChatReadStatus
from app.models.class_info import ClassInfo
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
from app.utils.auth import get_current_user
from datetime import datetime
import uuid

router = APIRouter()


def chat_to_response(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "class_id": m.class_id,
        "sender_id": m.sender_id,
        "sender_name": m.sender.name if m.sender else "",
        "sender_role": m.sender.role.value if m.sender else "",
        "avatar": m.sender.avatar or "" if m.sender else "",
        "content": m.content,
        "timestamp": m.timestamp,
    }


@router.get("/last-messages")
def get_last_messages(
    class_ids: str = Query(..., description="Comma-separated class IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, dict]:
    ids = [cid.strip() for cid in class_ids.split(",") if cid.strip()]
    result = {}
    for class_id in ids:
        msg = (
            db.query(ChatMessage)
            .options(joinedload(ChatMessage.sender))
            .filter(ChatMessage.class_id == class_id)
            .order_by(ChatMessage.timestamp.desc())
            .first()
        )
        if msg:
            result[class_id] = chat_to_response(msg)
    return result


@router.put("/mark-read")
def mark_read(
    class_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    status_row = db.query(ChatReadStatus).filter(
        ChatReadStatus.user_id == current_user.id,
        ChatReadStatus.class_id == class_id,
    ).first()
    now = datetime.utcnow()
    if status_row:
        status_row.last_read_at = now
    else:
        db.add(ChatReadStatus(user_id=current_user.id, class_id=class_id, last_read_at=now))
    db.commit()
    return {"message": "ok"}


@router.get("/unread-counts")
def get_unread_counts(
    class_ids: str = Query(..., description="Comma-separated class IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, int]:
    ids = [cid.strip() for cid in class_ids.split(",") if cid.strip()]
    result = {}
    for class_id in ids:
        read_status = db.query(ChatReadStatus).filter(
            ChatReadStatus.user_id == current_user.id,
            ChatReadStatus.class_id == class_id,
        ).first()
        query = db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.class_id == class_id,
            ChatMessage.sender_id != current_user.id,
        )
        if read_status:
            query = query.filter(ChatMessage.timestamp > read_status.last_read_at)
        count = query.scalar()
        if count > 0:
            result[class_id] = count
    return result


@router.get("/messages", response_model=List[ChatMessageResponse])
def list_messages(
    class_id: str = Query(..., description="Class ID to get messages for"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    messages = (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.sender))
        .filter(ChatMessage.class_id == class_id)
        .order_by(ChatMessage.timestamp.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [chat_to_response(m) for m in messages]


@router.post("/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(data: ChatMessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cls = db.query(ClassInfo).filter(ClassInfo.id == data.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    message = ChatMessage(
        id=f"msg{uuid.uuid4().hex[:7]}",
        class_id=data.class_id,
        sender_id=current_user.id,
        content=data.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    m = db.query(ChatMessage).options(joinedload(ChatMessage.sender)).filter(ChatMessage.id == message.id).first()
    return chat_to_response(m)
