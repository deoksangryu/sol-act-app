from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date, timedelta
from app.database import get_db
from app.models.lesson import Lesson, LessonStatus, LessonType
from app.models.class_info import ClassInfo
from app.models.user import User, UserRole
from app.schemas.lesson import LessonCreate, BulkLessonCreate, LessonUpdate, LessonResponse
from app.utils.auth import get_current_user
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
        "location": l.location,
        "memo": l.memo,
        "created_at": l.created_at,
    }


@router.get("/", response_model=List[LessonResponse])
def list_lessons(
    class_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Lesson).options(joinedload(Lesson.class_info))
    if class_id:
        query = query.filter(Lesson.class_id == class_id)
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
    l = db.query(Lesson).options(joinedload(Lesson.class_info)).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson_to_response(l)


@router.post("/", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
def create_lesson(
    data: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == data.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    lesson = Lesson(
        id=f"lsn{uuid.uuid4().hex[:7]}",
        class_id=data.class_id,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        lesson_type=data.lesson_type,
        location=data.location,
        memo=data.memo,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    l = db.query(Lesson).options(joinedload(Lesson.class_info)).filter(Lesson.id == lesson.id).first()
    return lesson_to_response(l)


@router.post("/bulk", response_model=List[LessonResponse], status_code=status.HTTP_201_CREATED)
def create_bulk_lessons(
    data: BulkLessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == data.class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

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
                location=data.location,
            )
            db.add(lesson)
            lessons.append(lesson)
        current += timedelta(days=1)

    db.commit()
    result = []
    for lesson in lessons:
        db.refresh(lesson)
        l = db.query(Lesson).options(joinedload(Lesson.class_info)).filter(Lesson.id == lesson.id).first()
        result.append(lesson_to_response(l))
    return result


@router.put("/{lesson_id}", response_model=LessonResponse)
def update_lesson(
    lesson_id: str,
    update_data: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).options(joinedload(Lesson.class_info)).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(l, field, value)

    db.commit()
    db.refresh(l)
    return lesson_to_response(l)


@router.put("/{lesson_id}/cancel", response_model=LessonResponse)
def cancel_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).options(joinedload(Lesson.class_info)).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    l.status = LessonStatus.CANCELLED
    db.commit()
    db.refresh(l)
    return lesson_to_response(l)


@router.put("/{lesson_id}/complete", response_model=LessonResponse)
def complete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).options(joinedload(Lesson.class_info)).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    l.status = LessonStatus.COMPLETED
    db.commit()
    db.refresh(l)
    return lesson_to_response(l)


@router.delete("/{lesson_id}")
def delete_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    l = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lesson not found")

    db.delete(l)
    db.commit()
    return {"message": "Lesson deleted"}
