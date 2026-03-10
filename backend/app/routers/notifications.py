from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationCreate, NotificationResponse, NotificationUpdate
from app.services.websocket_manager import manager
from app.utils.auth import get_current_user
import uuid

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = Notification(
        id=f"noti{uuid.uuid4().hex[:7]}",
        user_id=data.user_id,
        type=data.type,
        message=data.message,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Push via WebSocket if user is connected
    await manager.send_to_user(data.user_id, {
        "type": "new_notification",
        "data": {
            "id": notification.id,
            "type": notification.type.value,
            "message": notification.message,
            "read": notification.read,
            "created_at": notification.created_at.isoformat(),
        },
    })

    return notification


# mark-all-read must be defined BEFORE /{id} to avoid path conflict
@router.put("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: str,
    update_data: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    notification.read = update_data.read
    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted"}
