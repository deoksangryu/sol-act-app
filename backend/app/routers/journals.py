from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.lesson_journal import LessonJournal, JournalType
from app.models.lesson import Lesson
from app.models.user import User, UserRole
from app.schemas.lesson_journal import LessonJournalCreate, LessonJournalUpdate, LessonJournalResponse
from app.utils.auth import get_current_user
from app.services.ai import generate_journal_feedback
from app.services.notification_service import notify_user, notify_users, emit_data_changed, get_class_student_ids, get_teacher_class_ids, validate_class_access
import uuid

router = APIRouter()


def journal_to_response(j: LessonJournal) -> dict:
    return {
        "id": j.id,
        "lesson_id": j.lesson_id,
        "author_id": j.author_id,
        "author_name": j.author.name if j.author else "",
        "journal_type": j.journal_type,
        "content": j.content,
        "objectives": j.objectives,
        "next_plan": j.next_plan,
        "ai_feedback": j.ai_feedback,
        "media_urls": j.media_urls or [],
        "lesson_date": j.lesson.date if j.lesson else None,
        "created_at": j.created_at,
        "updated_at": j.updated_at,
    }


@router.get("/", response_model=List[LessonJournalResponse])
def list_journals(
    lesson_id: Optional[str] = Query(None),
    author_id: Optional[str] = Query(None),
    journal_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(LessonJournal).options(
        joinedload(LessonJournal.author), joinedload(LessonJournal.lesson)
    )
    # Teacher: only see journals for lessons in their classes
    if current_user.role == UserRole.TEACHER:
        my_class_ids = get_teacher_class_ids(db, current_user.id)
        lesson_ids_in_classes = [
            l.id for l in db.query(Lesson.id).filter(Lesson.class_id.in_(my_class_ids)).all()
        ]
        query = query.filter(LessonJournal.lesson_id.in_(lesson_ids_in_classes))
    # Student: only see own journals
    elif current_user.role == UserRole.STUDENT:
        query = query.filter(LessonJournal.author_id == current_user.id)
    if lesson_id:
        query = query.filter(LessonJournal.lesson_id == lesson_id)
    if author_id:
        query = query.filter(LessonJournal.author_id == author_id)
    if journal_type:
        try:
            jt = JournalType(journal_type)
            query = query.filter(LessonJournal.journal_type == jt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid journal_type: {journal_type}")
    journals = query.order_by(LessonJournal.created_at.desc()).all()
    return [journal_to_response(j) for j in journals]


@router.get("/{journal_id}", response_model=LessonJournalResponse)
def get_journal(journal_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    j = (
        db.query(LessonJournal)
        .options(joinedload(LessonJournal.author), joinedload(LessonJournal.lesson))
        .filter(LessonJournal.id == journal_id)
        .first()
    )
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")
    # Student: can only view own journals
    if current_user.role == UserRole.STUDENT and j.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    # Teacher: can only view journals for lessons in their classes
    if current_user.role == UserRole.TEACHER and j.lesson:
        my_class_ids = get_teacher_class_ids(db, current_user.id)
        if j.lesson.class_id not in my_class_ids:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    return journal_to_response(j)


@router.post("/", response_model=LessonJournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal(
    data: LessonJournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lesson = db.query(Lesson).filter(Lesson.id == data.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Validate user has access to this lesson
    if lesson.class_id:
        if not validate_class_access(db, lesson.class_id, current_user):
            raise HTTPException(status_code=403, detail="Not a member of this lesson's class")
    elif lesson.is_private:
        if current_user.role == UserRole.STUDENT and current_user.id not in (lesson.private_student_ids or []):
            raise HTTPException(status_code=403, detail="Not a participant of this private lesson")
        if current_user.role == UserRole.TEACHER and lesson.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not the teacher of this private lesson")

    journal = LessonJournal(
        id=f"jrn{uuid.uuid4().hex[:7]}",
        lesson_id=data.lesson_id,
        author_id=current_user.id,
        journal_type=data.journal_type,
        content=data.content,
        objectives=data.objectives,
        next_plan=data.next_plan,
        media_urls=data.media_urls,
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)
    j = (
        db.query(LessonJournal)
        .options(joinedload(LessonJournal.author), joinedload(LessonJournal.lesson))
        .filter(LessonJournal.id == journal.id)
        .first()
    )

    # Notify the other party about the new journal
    if lesson.teacher_id and lesson.teacher_id != current_user.id:
        await notify_user(
            db, lesson.teacher_id,
            f"{current_user.name}님이 수업일지를 작성했습니다.",
            entity="journals",
        )
    elif lesson.class_id:
        student_ids = get_class_student_ids(db, lesson.class_id)
        student_ids = [sid for sid in student_ids if sid != current_user.id]
        if student_ids:
            await notify_users(
                db, student_ids,
                "선생님이 수업일지를 작성했습니다.",
                entity="journals",
            )

    return journal_to_response(j)


@router.put("/{journal_id}", response_model=LessonJournalResponse)
async def update_journal(
    journal_id: str,
    update_data: LessonJournalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    j = (
        db.query(LessonJournal)
        .options(joinedload(LessonJournal.author), joinedload(LessonJournal.lesson))
        .filter(LessonJournal.id == journal_id)
        .first()
    )
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")

    if current_user.id != j.author_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(j, field, value)

    db.commit()
    db.refresh(j)

    lesson = db.query(Lesson).filter(Lesson.id == j.lesson_id).first()
    if lesson:
        if lesson.teacher_id and lesson.teacher_id != current_user.id:
            await emit_data_changed([lesson.teacher_id], "journals")
        elif lesson.class_id:
            student_ids = get_class_student_ids(db, lesson.class_id)
            student_ids = [sid for sid in student_ids if sid != current_user.id]
            if student_ids:
                await emit_data_changed(student_ids, "journals")

    return journal_to_response(j)


@router.post("/{journal_id}/ai-feedback")
async def request_ai_feedback(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    j = db.query(LessonJournal).filter(LessonJournal.id == journal_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")

    feedback = generate_journal_feedback(j.content, j.journal_type.value)
    j.ai_feedback = feedback
    db.commit()

    if j.author_id != current_user.id:
        await notify_user(
            db, j.author_id,
            "수업일지에 AI 피드백이 생성되었습니다.",
            entity="journals",
        )

    return {"ai_feedback": feedback}


@router.delete("/{journal_id}")
async def delete_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    j = db.query(LessonJournal).filter(LessonJournal.id == journal_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")

    if current_user.id != j.author_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    author_id = j.author_id
    db.delete(j)
    db.commit()

    if author_id and author_id != current_user.id:
        await emit_data_changed([author_id], "journals")

    return {"message": "Journal deleted"}
