from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.notice import Notice
from app.models.user import User, UserRole
from app.schemas.notice import NoticeCreate, NoticeUpdate, NoticeResponse
from app.utils.auth import get_current_user
from app.services.notification_service import notify_users, get_all_student_ids, emit_data_changed
import uuid

router = APIRouter()


@router.get("/", response_model=List[NoticeResponse])
def list_notices(
    class_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Notice)
    if class_id:
        # Return class-specific + academy-wide notices
        query = query.filter((Notice.class_id == class_id) | (Notice.class_id.is_(None)))
    return query.order_by(Notice.created_at.desc()).all()


@router.get("/{notice_id}", response_model=NoticeResponse)
def get_notice(notice_id: str, db: Session = Depends(get_db)):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice


@router.post("/", response_model=NoticeResponse, status_code=status.HTTP_201_CREATED)
async def create_notice(
    data: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Only teachers and directors can create notices")

    # Teachers must specify a class for class-specific notices
    if current_user.role == UserRole.TEACHER and not data.class_id:
        raise HTTPException(status_code=400, detail="Teachers must specify a class_id for notices")

    notice = Notice(
        id=f"notice{uuid.uuid4().hex[:7]}",
        title=data.title,
        content=data.content,
        author=data.author,
        important=data.important,
        class_id=data.class_id,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)

    student_ids = get_all_student_ids(db)
    if student_ids:
        await notify_users(
            db, student_ids,
            f"새 공지사항: {data.title}",
            entity="notices",
        )

    return notice


@router.put("/{notice_id}", response_model=NoticeResponse)
async def update_notice(
    notice_id: str,
    update_data: NoticeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(notice, field, value)

    db.commit()
    db.refresh(notice)

    student_ids = get_all_student_ids(db)
    if student_ids:
        await emit_data_changed(student_ids, "notices")

    return notice


@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    student_ids = get_all_student_ids(db)

    db.delete(notice)
    db.commit()

    if student_ids:
        await emit_data_changed(student_ids, "notices")

    return {"message": "Notice deleted"}
