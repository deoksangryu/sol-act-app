from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app.models.qna import Question, Answer
from app.models.user import User, UserRole
from app.schemas.qna import QuestionCreate, AnswerCreate, QuestionResponse, AnswerResponse
from app.utils.auth import get_current_user
from app.services.ai import ask_ai_tutor
from app.services.notification_service import notify_user, emit_data_changed
import uuid

router = APIRouter()


def question_to_response(q: Question) -> dict:
    return {
        "id": q.id,
        "title": q.title,
        "content": q.content,
        "author_id": q.author_id,
        "author_name": q.author.name if q.author else "",
        "views": q.views,
        "created_at": q.created_at,
        "answers": [
            {
                "id": a.id,
                "content": a.content,
                "author_name": a.author_name,
                "author_role": a.author_role,
                "is_ai": a.is_ai,
                "created_at": a.created_at,
            }
            for a in q.answers
        ],
    }


@router.get("/questions", response_model=List[QuestionResponse])
def list_questions(db: Session = Depends(get_db)):
    questions = (
        db.query(Question)
        .options(joinedload(Question.author), joinedload(Question.answers))
        .order_by(Question.created_at.desc())
        .all()
    )
    return [question_to_response(q) for q in questions]


@router.get("/questions/{question_id}", response_model=QuestionResponse)
def get_question(question_id: str, db: Session = Depends(get_db)):
    q = (
        db.query(Question)
        .options(joinedload(Question.author), joinedload(Question.answers))
        .filter(Question.id == question_id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    q.views += 1
    db.commit()
    db.refresh(q)
    return question_to_response(q)


@router.post("/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(
    data: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    question = Question(
        id=f"q{uuid.uuid4().hex[:7]}",
        title=data.title,
        content=data.content,
        author_id=current_user.id,
        views=0,
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    q = (
        db.query(Question)
        .options(joinedload(Question.author), joinedload(Question.answers))
        .filter(Question.id == question.id)
        .first()
    )
    return question_to_response(q)


@router.delete("/questions/{question_id}")
async def delete_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if current_user.id != q.author_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    author_id = q.author_id
    db.delete(q)
    db.commit()

    if author_id:
        await emit_data_changed([author_id], "qna")

    return {"message": "Question deleted"}


@router.post("/questions/{question_id}/answers/ai", response_model=AnswerResponse)
async def create_ai_answer(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    ai_response = ask_ai_tutor(q.content)

    answer = Answer(
        id=f"ans{uuid.uuid4().hex[:7]}",
        question_id=question_id,
        content=ai_response,
        author_name="AI 튜터",
        author_role="AI",
        is_ai=True,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    if q.author_id:
        await emit_data_changed([q.author_id], "qna")

    return answer


@router.post("/questions/{question_id}/answers", response_model=AnswerResponse, status_code=status.HTTP_201_CREATED)
async def create_answer(
    question_id: str,
    data: AnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Question).options(joinedload(Question.author)).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    answer = Answer(
        id=f"ans{uuid.uuid4().hex[:7]}",
        question_id=question_id,
        content=data.content,
        author_name=current_user.name,
        author_role=current_user.role.value,
        is_ai=False,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    if q.author_id:
        await notify_user(
            db, q.author_id,
            f"질문 '{q.title}'에 새 답변이 등록되었습니다.",
            entity="qna",
        )

    return answer


@router.delete("/answers/{answer_id}")
async def delete_answer(
    answer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Only teachers and directors can delete answers")

    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    q = db.query(Question).filter(Question.id == answer.question_id).first()
    db.delete(answer)
    db.commit()

    if q and q.author_id:
        await emit_data_changed([q.author_id], "qna")

    return {"message": "Answer deleted"}
