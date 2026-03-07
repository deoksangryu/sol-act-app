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
from app.services.notification_service import notify_users, get_class_student_ids, emit_data_changed, get_teacher_class_ids
from app.models.notification import NotificationType
import uuid

router = APIRouter()


def _check_teacher_lesson_access(db: Session, lesson: Lesson, teacher_id: str):
    """Raise 403 if teacher doesn't have access to this lesson's class."""
    my_class_ids = get_teacher_class_ids(db, teacher_id)
    if lesson.class_id and lesson.class_id not in my_class_ids:
        raise HTTPException(status_code=403, detail="Cannot modify lessons for classes you don't teach")
    if not lesson.class_id and lesson.teacher_id != teacher_id:
        raise HTTPException(status_code=403, detail="Cannot modify other teacher's private lessons")


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Lesson).options(
        joinedload(Lesson.class_info),
        joinedload(Lesson.teacher)
    )
    # Teacher: only see lessons for their classes
    if current_user.role == UserRole.TEACHER:
        my_class_ids = get_teacher_class_ids(db, current_user.id)
        query = query.filter(Lesson.class_id.in_(my_class_ids))
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
def get_lesson(lesson_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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

    # Teacher: validate class belongs to them
    if current_user.role == UserRole.TEACHER and data.class_id:
        my_class_ids = get_teacher_class_ids(db, current_user.id)
        if data.class_id not in my_class_ids:
            raise HTTPException(status_code=403, detail="Cannot create lessons for classes you don't teach")

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

    # Notify actor (teacher/director) so their own view refreshes
    await emit_data_changed([current_user.id], "lessons")

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

    # Teacher: validate class belongs to them
    if current_user.role == UserRole.TEACHER and data.class_id:
        my_class_ids = get_teacher_class_ids(db, current_user.id)
        if data.class_id not in my_class_ids:
            raise HTTPException(status_code=403, detail="Cannot create lessons for classes you don't teach")

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
            await notify_users(
                db, student_ids,
                f"새 수업 {len(lessons)}건이 등록되었습니다.",
                entity="lessons",
            )
    await emit_data_changed([current_user.id], "lessons")

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
    if current_user.role == UserRole.TEACHER:
        _check_teacher_lesson_access(db, l, current_user.id)

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
        await notify_users(
            db, affected_ids,
            f"수업 정보가 변경되었습니다. ({l.date} {l.start_time})",
            entity="lessons",
        )

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
    if current_user.role == UserRole.TEACHER:
        _check_teacher_lesson_access(db, l, current_user.id)

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
    if current_user.role == UserRole.TEACHER:
        _check_teacher_lesson_access(db, l, current_user.id)

    l.status = LessonStatus.COMPLETED
    db.commit()
    db.refresh(l)

    affected_ids = []
    if l.class_id:
        affected_ids = get_class_student_ids(db, l.class_id)
    elif l.private_student_ids:
        affected_ids = l.private_student_ids
    if affected_ids:
        await notify_users(
            db, affected_ids,
            f"수업이 완료 처리되었습니다. ({l.date} {l.start_time})",
            entity="lessons",
        )

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
    if current_user.role == UserRole.TEACHER:
        _check_teacher_lesson_access(db, l, current_user.id)

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
