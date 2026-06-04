from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.models.assignment import Assignment, AssignmentStatus
from app.models.portfolio import Portfolio
from app.models.diet import DietLog
from app.models.music import MusicDownloadRequest, RequestStatus
from app.services.notification_service import get_teacher_student_ids
from app.utils.auth import get_current_user

router = APIRouter()


@router.get("/badges")
def get_badges(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """하단 5탭의 미처리 항목 수(프로토타입 tb 뱃지). 역할별로 계산.

    student: 미제출 과제 / teacher·director: 피드백 없는 영상·식단, (원장) 대기 음원요청.
    """
    counts = {"classes": 0, "assignments": 0, "video": 0, "diet": 0, "music": 0}
    role = current_user.role

    if role == UserRole.STUDENT:
        counts["assignments"] = db.query(Assignment).filter(
            Assignment.student_id == current_user.id,
            Assignment.status == AssignmentStatus.PENDING,
        ).count()
        return counts

    # 최근 항목만 집계(과거 누적 백로그로 뱃지가 영구히 99+가 되는 것 방지)
    recent = datetime.utcnow() - timedelta(days=14)

    # teacher: 담당 학생 한정 / director: 전체
    pf = db.query(Portfolio)
    dl = db.query(DietLog)
    if role == UserRole.TEACHER:
        sids = get_teacher_student_ids(db, current_user.id)
        pf = pf.filter(Portfolio.student_id.in_(sids))
        dl = dl.filter(DietLog.student_id.in_(sids))

    # 영상: 최근 + 코멘트(피드백) 0개 + 실제 영상이 올라온 것
    counts["video"] = pf.filter(
        ~Portfolio.comments.any(), Portfolio.video_url != "", Portfolio.created_at >= recent
    ).count()
    # 식단: 최근 + 교사 코멘트 없는 것
    counts["diet"] = dl.filter(
        ((DietLog.teacher_comment.is_(None)) | (DietLog.teacher_comment == "")),
        DietLog.created_at >= recent,
    ).count()
    # 음악: 원장만 대기 요청 수(음원 요청은 원장 전용)
    if role == UserRole.DIRECTOR:
        counts["music"] = db.query(MusicDownloadRequest).filter(
            MusicDownloadRequest.status == RequestStatus.PENDING
        ).count()

    return counts
