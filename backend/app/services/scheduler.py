"""Background scheduler for registration deadline notifications.

Runs once per day (at server start, then every 24h).
Checks auditions with upcoming registration periods and notifies users.
"""
import asyncio
import logging
import time
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


async def check_plan_reminders() -> None:
    """저녁(19시 KST)에 '오늘의 하루계획'을 아직 안 세운 학생에게 한 번 푸시.

    학습 계획 습관 형성용. 멱등성: 동일 메시지가 최근 20시간 내 발송됐으면 건너뜀(하루 1회).
    푸시 수신은 기존 네이티브/웹푸시 인프라를 그대로 사용(앱 재배포 불필요).
    """
    db = SessionLocal()
    try:
        from app.models.plan import Plan, PlanType
        from app.models.notification import Notification
        from app.services.notification_service import notify_users

        kst_today = (datetime.utcnow() + timedelta(hours=9)).date()
        recent_cutoff = datetime.utcnow() - timedelta(hours=20)
        msg = "📝 오늘의 학습 계획을 세워볼까요? 하루 할 일을 적고 체크해봐요."

        already = db.query(Notification.id).filter(
            Notification.message == msg, Notification.created_at >= recent_cutoff
        ).first() is not None
        if already:
            logger.info("Skip duplicate plan reminder (already sent ≤20h)")
            return

        students = db.query(User.id).filter(User.role == UserRole.STUDENT).all()
        student_ids = [s[0] for s in students]
        if not student_ids:
            return

        # 오늘 '하루계획'이 이미 있는 학생 제외
        planned = db.query(Plan.student_id).filter(
            Plan.plan_type == PlanType.DAILY,
            Plan.plan_date == kst_today,
            Plan.student_id.in_(student_ids),
        ).all()
        planned_ids = {p[0] for p in planned}
        targets = [sid for sid in student_ids if sid not in planned_ids]
        if not targets:
            logger.info("Plan reminder: all students already planned today")
            return

        await notify_users(db, targets, msg, entity="plans")
        logger.info(f"Plan reminder sent to {len(targets)} student(s)")
    except Exception as e:
        logger.error(f"Plan reminder check failed: {e}")
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
            # 학습 계획 리마인더: 저녁(19시 이후 KST) 첫 틱에 1회(20h 멱등 가드가 중복 차단).
            # '== 19'가 아니라 '>= 19'라 틱이 19시대를 살짝 비껴가도 그날 리마인더를 놓치지 않음.
            if (datetime.utcnow() + timedelta(hours=9)).hour >= 19:
                await check_plan_reminders()
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
        ticks += 1
        # 매 정시(top-of-hour)에 맞춰 깨움 — 작업 시간만큼 누적 드리프트되어 특정 시각을
        # 영영 건너뛰는 문제 방지(이전엔 sleep(3600)이라 매 사이클이 1시간보다 길어 드리프트).
        await asyncio.sleep(max(60, 3600 - int(time.time()) % 3600))
