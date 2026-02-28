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
        "lesson_date": j.lesson.date if j.lesson else None,
        "created_at": j.created_at,
        "updated_at": j.updated_at,
    }


@router.get("/", response_model=List[LessonJournalResponse])
def list_journals(
    lesson_id: Optional[str] = Query(None),
    author_id: Optional[str] = Query(None),
    journal_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(LessonJournal).options(
        joinedload(LessonJournal.author), joinedload(LessonJournal.lesson)
    )
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
def get_journal(journal_id: str, db: Session = Depends(get_db)):
    j = (
        db.query(LessonJournal)
        .options(joinedload(LessonJournal.author), joinedload(LessonJournal.lesson))
        .filter(LessonJournal.id == journal_id)
        .first()
    )
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")
    return journal_to_response(j)


@router.post("/", response_model=LessonJournalResponse, status_code=status.HTTP_201_CREATED)
def create_journal(
    data: LessonJournalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lesson = db.query(Lesson).filter(Lesson.id == data.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    journal = LessonJournal(
        id=f"jrn{uuid.uuid4().hex[:7]}",
        lesson_id=data.lesson_id,
        author_id=current_user.id,
        journal_type=data.journal_type,
        content=data.content,
        objectives=data.objectives,
        next_plan=data.next_plan,
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
    return journal_to_response(j)


@router.put("/{journal_id}", response_model=LessonJournalResponse)
def update_journal(
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
    return journal_to_response(j)


@router.post("/{journal_id}/ai-feedback")
def request_ai_feedback(
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
    return {"ai_feedback": feedback}


@router.delete("/{journal_id}")
def delete_journal(
    journal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    j = db.query(LessonJournal).filter(LessonJournal.id == journal_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")

    if current_user.id != j.author_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    db.delete(j)
    db.commit()
    return {"message": "Journal deleted"}
