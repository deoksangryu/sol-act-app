"""Background scheduler for registration deadline notifications.

Runs once per day (at server start, then every 24h).
Checks auditions with upcoming registration periods and notifies users.
"""
import asyncio
import logging
from datetime import date, timedelta, datetime
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
        from app.models.notification import Notification

        # 멱등성 가드: 백엔드 재시작(시작 즉시 tick0 실행)으로 같은 알림이 다시 나가는 것 방지.
        # 최근 20시간 내 동일 메시지가 이미 발송됐으면 건너뜀(하루 1회 보장). created_at은 UTC.
        recent_cutoff = datetime.utcnow() - timedelta(hours=20)

        def _already_sent(m: str) -> bool:
            return db.query(Notification.id).filter(
                Notification.message == m,
                Notification.created_at >= recent_cutoff,
            ).first() is not None

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
                    if _already_sent(msg):
                        logger.info(f"Skip duplicate start reminder (already sent ≤20h): {a.title} (D-{days_until_start})")
                    else:
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
                    if _already_sent(msg):
                        logger.info(f"Skip duplicate end reminder (already sent ≤20h): {a.title} (D-{days_until_end})")
                    else:
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


def complete_past_lessons() -> int:
    """Flip SCHEDULED lessons whose end time has passed to COMPLETED.

    Enables the post-lesson flow (수업일지/학생일지/코칭댓글, 지난수업 목록) which is
    gated on COMPLETED status. The frontend also treats past-dated lessons as
    completed for immediacy, so this is the backend's eventual-consistency pass.
    """
    from datetime import datetime
    from app.models.lesson import Lesson, LessonStatus

    db = SessionLocal()
    try:
        now = datetime.now()
        today = now.date()
        cur_hm = now.strftime("%H:%M")
        lessons = db.query(Lesson).filter(Lesson.status == LessonStatus.SCHEDULED).all()
        n = 0
        for l in lessons:
            try:
                ended = (l.date < today) or (l.date == today and (l.end_time or "00:00") <= cur_hm)
            except TypeError:
                ended = l.date < today
            if ended:
                l.status = LessonStatus.COMPLETED
                n += 1
        if n:
            db.commit()
            logger.info(f"Auto-completed {n} past lesson(s)")
        return n
    except Exception as e:
        logger.error(f"Lesson auto-complete failed: {e}")
        db.rollback()
        return 0
    finally:
        db.close()


async def start_scheduler() -> None:
    """Start the scheduler loop (runs at startup, then every hour)."""
    logger.info("Scheduler started (audition reminders + lesson auto-complete)")
    ticks = 0
    while True:
        try:
            complete_past_lessons()
            # 가입마감 알림은 하루 1회로 충분 (스케줄러는 1시간 주기라 24틱마다)
            if ticks % 24 == 0:
                await check_registration_deadlines()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        ticks += 1
        # 1시간 주기 — 종료된 수업을 1시간 내 완료 처리
        await asyncio.sleep(3600)
