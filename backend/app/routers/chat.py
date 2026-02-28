from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app.models.chat import ChatMessage
from app.models.class_info import ClassInfo
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
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


@router.get("/messages", response_model=List[ChatMessageResponse])
def list_messages(
    class_id: str = Query(..., description="Class ID to get messages for"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
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
def send_message(data: ChatMessageCreate, db: Session = Depends(get_db)):
    cls = db.query(ClassInfo).filter(ClassInfo.id == data.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    sender = db.query(User).filter(User.id == data.sender_id).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    message = ChatMessage(
        id=f"msg{uuid.uuid4().hex[:7]}",
        class_id=data.class_id,
        sender_id=data.sender_id,
        content=data.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    m = db.query(ChatMessage).options(joinedload(ChatMessage.sender)).filter(ChatMessage.id == message.id).first()
    return chat_to_response(m)
