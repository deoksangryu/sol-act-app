"""Shared helper for creating notifications + WS push."""
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.models.class_info import ClassInfo
from app.services.websocket_manager import manager
import uuid

logger = logging.getLogger(__name__)


async def notify_user(
    db: Session,
    user_id: str,
    message: str,
    notif_type: NotificationType = NotificationType.INFO,
    entity: Optional[str] = None,
) -> None:
    """Create a notification in DB and push via WebSocket.

    Never raises — failures are logged but don't break the caller.
    If entity is provided, also sends a data_changed event for auto-refresh.
    """
    try:
        notif = Notification(
            id=f"noti{uuid.uuid4().hex[:7]}",
            user_id=user_id,
            type=notif_type,
            message=message,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        await manager.send_to_user(user_id, {
            "type": "new_notification",
            "data": {
                "id": notif.id,
                "type": notif.type.value,
                "message": notif.message,
                "read": notif.read,
                "created_at": notif.created_at.isoformat(),
            },
        })
        if entity:
            await manager.send_to_user(user_id, {
                "type": "data_changed",
                "entity": entity,
            })
    except Exception as e:
        logger.error(f"Failed to notify user {user_id}: {e}")
        db.rollback()


async def notify_users(
    db: Session,
    user_ids: List[str],
    message: str,
    notif_type: NotificationType = NotificationType.INFO,
    entity: Optional[str] = None,
) -> None:
    """Create notifications for multiple users."""
    for uid in user_ids:
        await notify_user(db, uid, message, notif_type, entity)


async def emit_data_changed(user_ids: List[str], entity: str) -> None:
    """Send data_changed event without creating a notification."""
    for uid in user_ids:
        try:
            await manager.send_to_user(uid, {
                "type": "data_changed",
                "entity": entity,
            })
        except Exception:
            pass


def get_class_student_ids(db: Session, class_id: str) -> List[str]:
    """Get all student IDs in a class."""
    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        return []
    return [s.id for s in cls.students]


def get_all_student_ids(db: Session) -> List[str]:
    """Get all student user IDs."""
    students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    return [s.id for s in students]


def get_all_user_ids(db: Session) -> List[str]:
    """Get ALL user IDs regardless of role."""
    users = db.query(User).all()
    return [u.id for u in users]


def get_teacher_ids_for_student(db: Session, student_id: str) -> List[str]:
    """Get teacher IDs from classes the student belongs to + directors."""
    teacher_ids = set()
    classes = db.query(ClassInfo).all()
    for cls in classes:
        student_ids = [s.id for s in cls.students]
        if student_id in student_ids and cls.subject_teachers:
            for tid in cls.subject_teachers.values():
                if tid:
                    teacher_ids.add(tid)
    directors = db.query(User).filter(User.role == UserRole.DIRECTOR).all()
    for d in directors:
        teacher_ids.add(d.id)
    return list(teacher_ids)
