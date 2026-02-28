from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification import NotificationCreate, NotificationResponse, NotificationUpdate
import uuid

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
def list_notifications(
    user_id: str = Query(..., description="User ID to get notifications for"),
    db: Session = Depends(get_db)
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(data: NotificationCreate, db: Session = Depends(get_db)):
    notification = Notification(
        id=f"noti{uuid.uuid4().hex[:7]}",
        user_id=data.user_id,
        type=data.type,
        message=data.message,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


# mark-all-read must be defined BEFORE /{id} to avoid path conflict
@router.put("/mark-all-read")
def mark_all_read(
    user_id: str = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/{notification_id}", response_model=NotificationResponse)
def update_notification(
    notification_id: str,
    update_data: NotificationUpdate,
    db: Session = Depends(get_db)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.read = update_data.read
    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted"}
