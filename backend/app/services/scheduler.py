"""Background scheduler for registration deadline notifications.

Runs once per day (at server start, then every 24h).
Checks auditions with upcoming registration periods and notifies users.
"""
import asyncio
import logging
from datetime import date, timedelta
from typing import List

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.audition import Audition, AuditionStatus
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

# Notify N days before registration start and end
REMIND_DAYS_BEFORE = [7, 3, 1, 0]


def _get_all_staff_and_student_ids(db: Session) -> List[str]:
    """Get all active user IDs (students + teachers + directors)."""
    users = db.query(User.id).all()
    return [u.id for u in users]


async def check_registration_deadlines() -> None:
    """Check for upcoming registration deadlines and send notifications."""
    db = SessionLocal()
    try:
        today = date.today()
        auditions = (
            db.query(Audition)
            .filter(Audition.status == AuditionStatus.UPCOMING)
            .all()
        )

        from app.services.notification_service import notify_users

        for a in auditions:
            # Check registration_start approaching
            if a.registration_start:
                days_until_start = (a.registration_start - today).days
                if days_until_start in REMIND_DAYS_BEFORE:
                    user_ids = _get_all_staff_and_student_ids(db)
                    if days_until_start == 0:
                        msg = f"📋 [{a.title}] 접수가 오늘 시작됩니다!"
                    else:
                        msg = f"📋 [{a.title}] 접수 시작까지 {days_until_start}일 남았습니다."
                    await notify_users(db, user_ids, msg, entity="auditions")
                    logger.info(f"Registration start reminder sent: {a.title} (D-{days_until_start})")

            # Check registration_end approaching
            if a.registration_end:
                days_until_end = (a.registration_end - today).days
                if days_until_end in REMIND_DAYS_BEFORE:
                    user_ids = _get_all_staff_and_student_ids(db)
                    if days_until_end == 0:
                        msg = f"🚨 [{a.title}] 접수 마감일입니다!"
                    elif days_until_end == 1:
                        msg = f"⚠️ [{a.title}] 접수 마감까지 1일 남았습니다!"
                    else:
                        msg = f"📋 [{a.title}] 접수 마감까지 {days_until_end}일 남았습니다."
                    await notify_users(db, user_ids, msg, entity="auditions")
                    logger.info(f"Registration end reminder sent: {a.title} (D-{days_until_end})")

            # Auto-mark registration period status
            # If registration_end has passed and event date has passed → completed
            if a.date and a.date.date() < today:
                a.status = AuditionStatus.COMPLETED
                db.commit()

    except Exception as e:
        logger.error(f"Registration deadline check failed: {e}")
        db.rollback()
    finally:
        db.close()


async def start_scheduler() -> None:
    """Start the daily scheduler loop."""
    logger.info("Registration deadline scheduler started")
    while True:
        try:
            await check_registration_deadlines()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        # Run once per day (86400 seconds)
        await asyncio.sleep(86400)
