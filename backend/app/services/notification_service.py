"""Shared helper for creating notifications + WS push + Web Push."""
import json
import logging
import threading
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.models.class_info import ClassInfo
from app.services.websocket_manager import manager
import uuid

logger = logging.getLogger(__name__)


def _send_web_push_sync(user_id: str, message: str) -> None:
    """Send Web Push in a background thread with its own DB session.

    Uses a separate DB session so the caller's session is not blocked.
    Expired/invalid subscriptions are automatically cleaned up.
    """
    try:
        from app.config import settings
        if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
            return

        from app.models.push_subscription import PushSubscription
        from pywebpush import webpush, WebPushException
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            subs = db.query(PushSubscription).filter(
                PushSubscription.user_id == user_id
            ).all()

            payload = json.dumps({
                "title": "SOL-ACT",
                "body": message,
                "icon": "/icon-192.png",
                "badge": "/icon-192.png",
            })

            for sub in subs:
                try:
                    webpush(
                        subscription_info={
                            "endpoint": sub.endpoint,
                            "keys": {
                                "p256dh": sub.p256dh_key,
                                "auth": sub.auth_key,
                            },
                        },
                        data=payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
                    )
                except WebPushException as e:
                    if e.response and e.response.status_code in (404, 410):
                        db.delete(sub)
                        db.commit()
                    else:
                        logger.warning(f"Web push failed for {sub.endpoint[:50]}: {e}")
                except Exception as e:
                    logger.warning(f"Web push error: {e}")
        finally:
            db.close()
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"Web push setup error: {e}")


def _send_web_push(user_id: str, message: str) -> None:
    """Fire-and-forget Web Push in a background thread."""
    threading.Thread(
        target=_send_web_push_sync,
        args=(user_id, message),
        daemon=True,
    ).start()


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
    except Exception as e:
        logger.error(f"Failed to save notification for {user_id}: {e}")
        db.rollback()
        return
    try:
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
        logger.warning(f"Failed to send WS notification to {user_id}: {e}")
    # Web Push for background/offline users (fire-and-forget in background thread)
    _send_web_push(user_id, message)


async def notify_users(
    db: Session,
    user_ids: List[str],
    message: str,
    notif_type: NotificationType = NotificationType.INFO,
    entity: Optional[str] = None,
) -> None:
    """Create notifications for multiple users with batch DB insert."""
    if not user_ids:
        return

    # 1) Batch insert all notifications in a single commit
    notifs = []
    for uid in user_ids:
        notif = Notification(
            id=f"noti{uuid.uuid4().hex[:7]}",
            user_id=uid,
            type=notif_type,
            message=message,
        )
        db.add(notif)
        notifs.append(notif)
    try:
        db.commit()
        for notif in notifs:
            db.refresh(notif)
    except Exception as e:
        logger.error(f"Failed to batch-save notifications: {e}")
        db.rollback()
        return

    # 2) Send WebSocket notifications
    for notif in notifs:
        try:
            await manager.send_to_user(notif.user_id, {
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
                await manager.send_to_user(notif.user_id, {
                    "type": "data_changed",
                    "entity": entity,
                })
        except Exception as e:
            logger.warning(f"Failed to send WS to {notif.user_id}: {e}")

    # 3) Fire-and-forget Web Push in background threads
    for uid in user_ids:
        _send_web_push(uid, message)


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


def notify_user_sync(
    user_id: str,
    message: str,
    notif_type: "NotificationType" = None,
) -> None:
    """Synchronous version of notify_user — safe to call from background threads.

    Creates a DB notification record and sends a Web Push.
    Does NOT send a WebSocket message (caller must handle that separately).
    """
    if notif_type is None:
        notif_type = NotificationType.INFO
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            notif = Notification(
                id=f"noti{uuid.uuid4().hex[:7]}",
                user_id=user_id,
                type=notif_type,
                message=message,
            )
            db.add(notif)
            db.commit()
        except Exception as e:
            logger.error(f"notify_user_sync: failed to save notification: {e}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"notify_user_sync error: {e}")
    _send_web_push_sync(user_id, message)


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


def get_teacher_class_ids(db: Session, teacher_id: str) -> List[str]:
    """Get class IDs where the teacher is assigned."""
    classes = db.query(ClassInfo).all()
    return [
        cls.id for cls in classes
        if cls.subject_teachers and teacher_id in cls.subject_teachers.values()
    ]


def get_teacher_student_ids(db: Session, teacher_id: str) -> List[str]:
    """Get all student IDs from classes where the teacher is assigned."""
    student_ids = set()
    classes = db.query(ClassInfo).all()
    for cls in classes:
        if cls.subject_teachers and teacher_id in cls.subject_teachers.values():
            for s in cls.students:
                student_ids.add(s.id)
    return list(student_ids)


def validate_class_access(db: Session, class_id: str, user: "User") -> bool:
    """Check if a user has access to a class (member, teacher, or director)."""
    if user.role == UserRole.DIRECTOR:
        return True
    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        return False
    if user.role == UserRole.TEACHER:
        return cls.subject_teachers and user.id in cls.subject_teachers.values()
    # Student: check enrollment
    return any(s.id == user.id for s in cls.students)


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
