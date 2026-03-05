from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.private_lesson import PrivateLessonRequest, RequestStatus
from app.models.lesson import Lesson, LessonStatus, LessonType
from app.models.user import User, UserRole
from app.schemas.private_lesson import (
    PrivateLessonRequestCreate, PrivateLessonRequestRespond, PrivateLessonRequestResponse
)
from app.utils.auth import get_current_user
from app.services.notification_service import notify_user, emit_data_changed
from app.models.notification import NotificationType
import uuid

router = APIRouter()


def request_to_response(r: PrivateLessonRequest) -> dict:
    return {
        "id": r.id,
        "student_id": r.student_id,
        "student_name": r.student.name if r.student else "",
        "teacher_id": r.teacher_id,
        "teacher_name": r.teacher.name if r.teacher else "",
        "subject": r.subject,
        "preferred_date": r.preferred_date,
        "preferred_start_time": r.preferred_start_time,
        "preferred_end_time": r.preferred_end_time,
        "reason": r.reason,
        "status": r.status,
        "response_note": r.response_note,
        "created_at": r.created_at,
        "responded_at": r.responded_at,
    }


@router.get("/", response_model=List[PrivateLessonRequestResponse])
def list_requests(
    student_id: Optional[str] = Query(None),
    teacher_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PrivateLessonRequest)
    if student_id:
        query = query.filter(PrivateLessonRequest.student_id == student_id)
    if teacher_id:
        query = query.filter(PrivateLessonRequest.teacher_id == teacher_id)
    if status_filter:
        try:
            s = RequestStatus(status_filter)
            query = query.filter(PrivateLessonRequest.status == s)
        except ValueError:
            pass
    requests = query.order_by(PrivateLessonRequest.created_at.desc()).all()
    return [request_to_response(r) for r in requests]


@router.post("/", response_model=PrivateLessonRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: PrivateLessonRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = PrivateLessonRequest(
        id=f"plr{uuid.uuid4().hex[:7]}",
        student_id=current_user.id,
        teacher_id=data.teacher_id,
        subject=data.subject,
        preferred_date=data.preferred_date,
        preferred_start_time=data.preferred_start_time,
        preferred_end_time=data.preferred_end_time,
        reason=data.reason,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    await notify_user(
        db, data.teacher_id,
        f"{current_user.name}님이 개인레슨을 신청했습니다. ({data.subject})",
        entity="private_lessons",
    )

    return request_to_response(req)


@router.put("/{request_id}/respond", response_model=PrivateLessonRequestResponse)
async def respond_to_request(
    request_id: str,
    data: PrivateLessonRequestRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    req = db.query(PrivateLessonRequest).filter(PrivateLessonRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = data.status
    req.response_note = data.response_note
    req.responded_at = datetime.utcnow()

    # Auto-create lesson on approval
    if data.status == RequestStatus.APPROVED:
        from datetime import date as date_type
        lesson = Lesson(
            id=f"lsn{uuid.uuid4().hex[:7]}",
            class_id=None,
            date=date_type.fromisoformat(req.preferred_date),
            start_time=req.preferred_start_time,
            end_time=req.preferred_end_time,
            subject=req.subject,
            teacher_id=req.teacher_id,
            is_private=True,
            private_student_ids=[req.student_id],
            request_id=req.id,
            location="개인 연습실",
        )
        db.add(lesson)

    db.commit()
    db.refresh(req)

    status_text = "승인" if data.status == RequestStatus.APPROVED else "거절"
    await notify_user(
        db, req.student_id,
        f"개인레슨 신청이 {status_text}되었습니다. ({req.subject})",
        NotificationType.SUCCESS if data.status == RequestStatus.APPROVED else NotificationType.WARNING,
        entity="private_lessons",
    )

    return request_to_response(req)


@router.delete("/{request_id}")
async def delete_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = db.query(PrivateLessonRequest).filter(PrivateLessonRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.student_id != current_user.id and current_user.role == UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    teacher_id = req.teacher_id
    db.delete(req)
    db.commit()

    if teacher_id:
        await emit_data_changed([teacher_id], "private_lessons")

    return {"message": "Request deleted"}
