"""Admin-only API endpoints — no auth required, localhost access only."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.user import User, UserRole
from app.models.assignment import Assignment
from app.models.lesson import Lesson
from app.models.lesson_journal import LessonJournal
from app.models.portfolio import Portfolio, PortfolioComment
from app.models.evaluation import Evaluation
from app.models.diet import DietLog
from app.models.attendance import Attendance
from app.models.class_info import ClassInfo
from app.models.invite_code import InviteCode

router = APIRouter()


def require_localhost(request: Request):
    """Only allow access from localhost."""
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=403, detail="Admin access is localhost only")


@router.get("/stats")
def admin_stats(request: Request, db: Session = Depends(get_db)):
    require_localhost(request)
    students = db.query(User).filter(User.role == UserRole.STUDENT).count()
    teachers = db.query(User).filter(User.role == UserRole.TEACHER).count()
    directors = db.query(User).filter(User.role == UserRole.DIRECTOR).count()
    assignments_pending = db.query(Assignment).filter(Assignment.status == "pending").count()
    assignments_submitted = db.query(Assignment).filter(Assignment.status == "submitted").count()
    portfolios = db.query(Portfolio).count()
    lessons_total = db.query(Lesson).count()
    return {
        "students": students, "teachers": teachers, "directors": directors,
        "assignments_pending": assignments_pending, "assignments_submitted": assignments_submitted,
        "portfolios": portfolios, "lessons_total": lessons_total,
    }


@router.get("/students")
def admin_students(request: Request, db: Session = Depends(get_db)):
    require_localhost(request)
    users = db.query(User).filter(User.role == UserRole.STUDENT).all()
    classes = db.query(ClassInfo).all()
    result = []
    for u in users:
        # Find classes
        user_classes = [c.name for c in classes if u.id in [s.id for s in c.students]]
        # Count assignments
        assignments = db.query(Assignment).filter(Assignment.student_id == u.id).all()
        pending = len([a for a in assignments if a.status.value == "pending"])
        submitted = len([a for a in assignments if a.status.value == "submitted"])
        graded = len([a for a in assignments if a.status.value == "graded"])
        # Portfolio count
        portfolio_count = db.query(Portfolio).filter(Portfolio.student_id == u.id).count()
        # Attendance rate
        att_records = db.query(Attendance).filter(Attendance.student_id == u.id).all()
        att_total = len(att_records)
        att_present = len([a for a in att_records if a.status.value in ("present", "late")])
        att_rate = round(att_present / att_total * 100, 1) if att_total > 0 else 0
        result.append({
            "id": u.id, "name": u.name, "email": u.email, "avatar": u.avatar,
            "classes": user_classes,
            "assignments": {"pending": pending, "submitted": submitted, "graded": graded},
            "portfolio_count": portfolio_count,
            "attendance_rate": att_rate, "attendance_total": att_total,
        })
    return result


@router.get("/students/{student_id}")
def admin_student_detail(student_id: str, request: Request, db: Session = Depends(get_db)):
    require_localhost(request)
    user = db.query(User).filter(User.id == student_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    assignments = db.query(Assignment).filter(Assignment.student_id == student_id).order_by(Assignment.due_date.desc()).all()
    diets = db.query(DietLog).filter(DietLog.student_id == student_id).order_by(DietLog.date.desc()).limit(30).all()
    portfolios = db.query(Portfolio).options(
        joinedload(Portfolio.comments).joinedload(PortfolioComment.author)
    ).filter(Portfolio.student_id == student_id).order_by(Portfolio.created_at.desc()).all()
    evaluations = db.query(Evaluation).options(
        joinedload(Evaluation.evaluator), joinedload(Evaluation.class_info)
    ).filter(Evaluation.student_id == student_id).order_by(Evaluation.created_at.desc()).all()
    attendances = db.query(Attendance).filter(Attendance.student_id == student_id).order_by(Attendance.created_at.desc()).limit(50).all()

    return {
        "user": {"id": user.id, "name": user.name, "email": user.email, "avatar": user.avatar},
        "assignments": [{
            "id": a.id, "title": a.title, "status": a.status.value,
            "description": a.description,
            "due_date": str(a.due_date), "grade": a.grade, "feedback": a.feedback,
            "submission_text": a.submission_text,
            "submission_file_url": a.submission_file_url,
            "ai_analysis": a.ai_analysis,
        } for a in assignments],
        "diets": [{
            "id": d.id, "date": str(d.date), "meal_type": d.meal_type.value,
            "description": d.description, "calories": d.calories,
            "ai_advice": d.ai_advice, "teacher_comment": d.teacher_comment,
            "image_url": d.image_url,
        } for d in diets],
        "portfolios": [{
            "id": p.id, "title": p.title, "category": p.category.value,
            "description": p.description,
            "tags": p.tags, "created_at": str(p.created_at),
            "video_url": p.video_url,
            "ai_feedback": p.ai_feedback,
            "video_duration": p.video_duration,
            "comments": [{
                "author_name": c.author.name if c.author else "?",
                "content": c.content,
                "timestamp_sec": c.timestamp_sec,
                "created_at": str(c.created_at),
            } for c in p.comments],
        } for p in portfolios],
        "evaluations": [{
            "id": e.id, "period": e.period,
            "class_name": e.class_info.name if e.class_info else "",
            "evaluator_name": e.evaluator.name if e.evaluator else "",
            "subject": e.subject.value if e.subject else "",
            "scores": {
                "acting": e.acting_skill, "expression": e.expressiveness,
                "creativity": e.creativity, "teamwork": e.teamwork, "effort": e.effort,
            },
            "comment": e.comment,
        } for e in evaluations],
        "attendances": [{
            "id": a.id, "status": a.status.value, "note": a.note,
            "created_at": str(a.created_at),
        } for a in attendances],
    }


@router.get("/activity")
def admin_activity(request: Request, db: Session = Depends(get_db)):
    require_localhost(request)
    activities = []

    # Recent assignments
    assignments = db.query(Assignment).options(joinedload(Assignment.student)).order_by(Assignment.updated_at.desc()).limit(20).all()
    for a in assignments:
        activities.append({
            "type": "assignment",
            "text": f"{a.student.name if a.student else '?'}님의 과제 '{a.title}' — {a.status.value}",
            "time": str(a.updated_at),
        })

    # Recent journals
    journals = db.query(LessonJournal).options(joinedload(LessonJournal.author)).order_by(LessonJournal.created_at.desc()).limit(10).all()
    for j in journals:
        activities.append({
            "type": "journal",
            "text": f"{j.author.name if j.author else '?'}님이 수업일지를 작성했습니다.",
            "time": str(j.created_at),
        })

    # Recent portfolios
    portfolios = db.query(Portfolio).options(joinedload(Portfolio.student)).order_by(Portfolio.created_at.desc()).limit(10).all()
    for p in portfolios:
        activities.append({
            "type": "portfolio",
            "text": f"{p.student.name if p.student else '?'}님이 포트폴리오 '{p.title}'을 등록했습니다.",
            "time": str(p.created_at),
        })

    activities.sort(key=lambda x: x["time"], reverse=True)
    return activities[:30]


@router.get("/invite-codes")
def admin_invite_codes(request: Request, db: Session = Depends(get_db)):
    require_localhost(request)
    codes = db.query(InviteCode).order_by(InviteCode.created_at.desc()).all()
    return [
        {
            "code": c.code,
            "role": c.role.value,
            "used": c.used,
            "used_by": c.used_by,
            "memo": c.memo,
            "created_at": str(c.created_at) if c.created_at else None,
        }
        for c in codes
    ]
