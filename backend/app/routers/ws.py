from typing import Optional, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.chat import ChatMessage
from app.models.class_info import ClassInfo
from app.services.websocket_manager import manager
import uuid

router = APIRouter()


def verify_ws_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM],
            options={"verify_exp": True}
        )
        return payload.get("sub")
    except JWTError:
        return None


def get_class_member_ids(db, class_id: str) -> List[str]:
    """Get all user IDs that belong to a class (students + teachers + directors)."""
    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        return []
    member_ids = [s.id for s in cls.students]
    # Add teachers from subject_teachers
    if cls.subject_teachers:
        for teacher_id in cls.subject_teachers.values():
            if teacher_id and teacher_id not in member_ids:
                member_ids.append(teacher_id)
    # Include directors (they see all classes)
    directors = db.query(User).filter(User.role == UserRole.DIRECTOR).all()
    for d in directors:
        if d.id not in member_ids:
            member_ids.append(d.id)
    return member_ids


@router.websocket("/stream")
async def ws_stream(websocket: WebSocket, token: str = Query(...)):
    user_id = verify_ws_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            try:
                data = await websocket.receive_json()
            except (ValueError, TypeError):
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue
            msg_type = data.get("type")

            if msg_type == "chat_send":
                class_id = data.get("class_id", "").strip()
                content = data.get("content", "").strip()[:5000]
                if not class_id or not content:
                    continue

                db = SessionLocal()
                try:
                    sender = db.query(User).filter(User.id == user_id).first()
                    if not sender:
                        continue

                    message = ChatMessage(
                        id=f"msg{uuid.uuid4().hex[:7]}",
                        class_id=class_id,
                        sender_id=user_id,
                        content=content,
                    )
                    db.add(message)
                    db.commit()
                    db.refresh(message)

                    response = {
                        "type": "new_message",
                        "data": {
                            "id": message.id,
                            "class_id": message.class_id,
                            "sender_id": message.sender_id,
                            "sender_name": sender.name,
                            "sender_role": sender.role.value,
                            "avatar": sender.avatar or "",
                            "content": message.content,
                            "timestamp": message.timestamp.isoformat(),
                        },
                    }
                    member_ids = get_class_member_ids(db, class_id)
                finally:
                    db.close()

                await manager.broadcast_to_users(member_ids, response)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
