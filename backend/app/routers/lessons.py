from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, timedelta
from app.database import get_db
from app.models.lesson import Lesson, LessonStatus, LessonType, Subject
from app.models.class_info import ClassInfo
from app.models.user import User, UserRole
from app.schemas.lesson import LessonCreate, BulkLessonCreate, LessonUpdate, LessonResponse
from app.utils.auth import get_current_user
from app.services.notification_service import notify_users, get_class_student_ids, emit_data_changed
from app.models.notification import NotificationType
import uuid

router = APIRouter()


def lesson_to_response(l: Lesson) -> dict:
    return {
        "id": l.id,
        "class_id": l.class_id,
        "class_name": l.class_info.name if l.class_info else "",
        "date": l.date,
        "start_time": l.start_time,
        "end_time": l.end_time,
        "status": l.status,
        "lesson_type": l.lesson_type,
        "subject": l.subject,
        "teacher_id": l.teacher_id,
        "teacher_name": l.teacher.name if l.teacher else None,
        "location": l.location,
        "memo": l.memo,
        "is_private": l.is_private,
        "private_student_ids": l.private_student_ids,
        "request_id": l.request_id,
        "created_at": l.created_at,
    }


@router.get("/", response_model=List[LessonResponse])
def list_lessons(
    class_id: Optional[str] = Query(None),
    teacher_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    )
    if class_id:
        query = query.filter(Lesson.class_id == class_id)
    if teacher_id:
        query = query.filter(Lesson.teacher_id == teacher_id)
    if date_from:
        query = query.filter(Lesson.date >= date_from)
    if date_to:
        query = query.filter(Lesson.date <= date_to)
    if status_filter:
        try:
            s = LessonStatus(status_filter)
            query = query.filter(Lesson.status == s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_filter}")
    lessons = query.order_by(Lesson.date.asc(), Lesson.start_time.asc()).all()
    return [lesson_to_response(l) for l in lessons]


@router.get("/{lesson_id}", response_model=LessonResponse)
def get_lesson(lesson_id: str, db: Session = Depends(get_db)):
    l = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    ).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson_to_response(l)


@router.post("/", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    data: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lesson = Lesson(
        id=f"lsn{uuid.uuid4().hex[:7]}",
        class_id=data.class_id,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        lesson_type=data.lesson_type,
        subject=data.subject,
        teacher_id=data.teacher_id or current_user.id,
        location=data.location,
        memo=data.memo,
        is_private=data.is_private,
        private_student_ids=data.private_student_ids,
        request_id=data.request_id,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    if data.class_id:
        student_ids = get_class_student_ids(db, data.class_id)
        if student_ids:
            await notify_users(
                db, student_ids,
                f"새 수업이 등록되었습니다. ({data.date} {data.start_time})",
                entity="lessons",
            )
    elif data.private_student_ids:
        await emit_data_changed(data.private_student_ids, "lessons")

    l = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    ).filter(Lesson.id == lesson.id).first()
    return lesson_to_response(l)


@router.post("/bulk", response_model=List[LessonResponse], status_code=status.HTTP_201_CREATED)
async def create_bulk_lessons(
    data: BulkLessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lessons = []
    current = data.start_date
    while current <= data.end_date:
        if current.weekday() in data.weekdays:
            lesson = Lesson(
                id=f"lsn{uuid.uuid4().hex[:7]}",
                class_id=data.class_id,
                date=current,
                start_time=data.start_time,
                end_time=data.end_time,
                lesson_type=data.lesson_type,
                subject=data.subject,
                teacher_id=data.teacher_id or current_user.id,
                location=data.location,
            )
            db.add(lesson)
            lessons.append(lesson)
        current += timedelta(days=1)

    db.commit()
    result = []
    for lesson in lessons:
        db.refresh(lesson)
        l = db.query(Lesson).options(
            joinedload(Lesson.class_info),
            joinedload(Lesson.teacher)
        ).filter(Lesson.id == lesson.id).first()
        result.append(lesson_to_response(l))

    if data.class_id and lessons:
        student_ids = get_class_student_ids(db, data.class_id)
        if student_ids:
            await emit_data_changed(student_ids, "lessons")

    return result


@router.put("/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: str,
    update_data: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    ).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(l, field, value)

    db.commit()
    db.refresh(l)

    affected_ids = []
    if l.class_id:
        affected_ids = get_class_student_ids(db, l.class_id)
    elif l.private_student_ids:
        affected_ids = l.private_student_ids
    if affected_ids:
        await emit_data_changed(affected_ids, "lessons")

    return lesson_to_response(l)


@router.put("/{lesson_id}/cancel", response_model=LessonResponse)
async def cancel_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    ).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    l.status = LessonStatus.CANCELLED
    db.commit()
    db.refresh(l)

    if l.class_id:
        student_ids = get_class_student_ids(db, l.class_id)
        if student_ids:
            await notify_users(
                db, student_ids,
                f"수업이 취소되었습니다. ({l.date} {l.start_time})",
                NotificationType.WARNING,
                entity="lessons",
            )
    elif l.private_student_ids:
        await notify_users(
            db, l.private_student_ids,
            f"개인레슨이 취소되었습니다. ({l.date} {l.start_time})",
            NotificationType.WARNING,
            entity="lessons",
        )

    return lesson_to_response(l)


@router.put("/{lesson_id}/complete", response_model=LessonResponse)
async def complete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    ).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    l.status = LessonStatus.COMPLETED
    db.commit()
    db.refresh(l)

    affected_ids = []
    if l.class_id:
        affected_ids = get_class_student_ids(db, l.class_id)
    elif l.private_student_ids:
        affected_ids = l.private_student_ids
    if affected_ids:
        await emit_data_changed(affected_ids, "lessons")

    return lesson_to_response(l)


@router.delete("/{lesson_id}")
async def delete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    affected_ids = []
    if l.class_id:
        affected_ids = get_class_student_ids(db, l.class_id)
    elif l.private_student_ids:
        affected_ids = l.private_student_ids

    db.delete(l)
    db.commit()

    if affected_ids:
        await emit_data_changed(affected_ids, "lessons")

    return {"message": "Lesson deleted"}
