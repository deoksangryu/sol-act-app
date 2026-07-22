"""원장/강사 대시보드 — 예외만 보는 현황. 전부 신규 테이블 + 기존 테이블 read-only 집계."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta

from app.database import get_db
from app.models.user import User, UserRole
from app.models.gamification import Streak, UserActivity
from app.models.submission import Submission
from app.models.lesson_journal import LessonJournal
from app.models.class_info import ClassInfo
from app.utils.auth import get_current_user
from app.services.notification_service import get_teacher_student_ids
from app.utils.timezone import today_kst, kst_day_start_utc

router = APIRouter()


def _require_staff(u: User):
    if u.role not in (UserRole.TEACHER, UserRole.DIRECTOR):
        raise HTTPException(status_code=403, detail="강사/원장 전용")


@router.get("/stats")
def stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_staff(current_user)
    today = today_kst()
    now = datetime.utcnow()
    today0 = kst_day_start_utc()  # 수업일지 '오늘' = 한국 달력 오늘

    students_total = db.query(User).filter(User.role == UserRole.STUDENT).count()
    curtaincall_today = db.query(Streak).filter(Streak.last_date == today).count()
    pending_feedback = db.query(Submission).filter(Submission.status == "open").count()

    # 리드타임 중앙값 (최근 14일 처리완료)
    since = now - timedelta(days=14)
    done = db.query(Submission).filter(
        Submission.status == "done", Submission.first_feedback_at.isnot(None), Submission.first_feedback_at >= since,
    ).all()
    leads = sorted((s.first_feedback_at - s.created_at).total_seconds() for s in done if s.created_at and s.first_feedback_at)
    if leads:
        n = len(leads)
        mid = leads[n // 2] if n % 2 else (leads[n // 2 - 1] + leads[n // 2]) / 2
        leadtime_median_hours = round(mid / 3600, 1)
    else:
        leadtime_median_hours = None

    # 수업일지 작성률(오늘)
    journals_today = db.query(LessonJournal).filter(LessonJournal.created_at >= today0).count()
    classes_total = db.query(ClassInfo).count()
    journal_rate = round(min(journals_today, classes_total) / classes_total * 100) if classes_total else 0

    # 확인이 필요해요 — 슬럼프(3일+ 미접속)
    cutoff = now - timedelta(days=3)
    slump = db.query(UserActivity, User).join(User, User.id == UserActivity.student_id).filter(
        UserActivity.last_active_at < cutoff,
    ).order_by(UserActivity.last_active_at.asc()).limit(10).all()
    attention = [{"name": u.name, "reason": f"{max(1, (now - ua.last_active_at).days)}일 미접속"} for ua, u in slump]

    # 클래스별
    classes = db.query(ClassInfo).all()
    class_rows = []
    for c in classes:
        member_ids = [s.id for s in c.students] or ["__none__"]
        opens = db.query(Submission).filter(Submission.status == "open", Submission.student_id.in_(member_ids)).count()
        subs = db.query(Submission).filter(Submission.student_id.in_(member_ids), Submission.created_at >= now - timedelta(days=7)).count()
        class_rows.append({"id": c.id, "name": c.name, "members": len([m for m in member_ids if m != "__none__"]), "open": opens, "submissions_week": subs})

    return {
        "students_total": students_total,
        "curtaincall_today": curtaincall_today,
        "pending_feedback": pending_feedback,
        "leadtime_median_hours": leadtime_median_hours,
        "journal_rate": journal_rate,
        "attention": attention,
        "classes": class_rows,
    }


@router.get("/roster")
def roster(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """강사=담당 학생 / 원장=전체 학생 — 스트릭·주간 제출·슬럼프."""
    _require_staff(current_user)
    now = datetime.utcnow()
    if current_user.role == UserRole.DIRECTOR:
        students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    else:
        ids = get_teacher_student_ids(db, current_user.id) or ["__none__"]
        students = db.query(User).filter(User.id.in_(ids)).all()

    sids = [s.id for s in students] or ["__none__"]
    streaks = {r.student_id: r for r in db.query(Streak).filter(Streak.student_id.in_(sids)).all()}
    acts = {a.student_id: a for a in db.query(UserActivity).filter(UserActivity.student_id.in_(sids)).all()}
    week_since = now - timedelta(days=7)
    rows = []
    for s in students:
        st = streaks.get(s.id)
        act = acts.get(s.id)
        week = db.query(Submission).filter(Submission.student_id == s.id, Submission.created_at >= week_since).count()
        slump = bool(act and (now - act.last_active_at).days >= 3)
        rows.append({
            "id": s.id, "name": s.name,
            "streak": st.current if st else 0,
            "week_submissions": week,
            "slump": slump,
        })
    rows.sort(key=lambda r: (-r["streak"], r["name"]))
    return rows
