from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.evaluation import Evaluation
from app.models.lesson import Subject
from app.models.user import User, UserRole
from app.models.class_info import ClassInfo
from app.schemas.evaluation import EvaluationCreate, EvaluationUpdate, EvaluationResponse
from app.utils.auth import get_current_user
from app.services.ai import generate_evaluation_summary
from app.services.notification_service import notify_user, emit_data_changed
import uuid

router = APIRouter()


def evaluation_to_response(e: Evaluation) -> dict:
    return {
        "id": e.id,
        "student_id": e.student_id,
        "student_name": e.student.name if e.student else "",
        "evaluator_id": e.evaluator_id,
        "evaluator_name": e.evaluator.name if e.evaluator else "",
        "class_id": e.class_id,
        "class_name": e.class_info.name if e.class_info else "",
        "subject": e.subject,
        "period": e.period,
        "scores": {
            "acting": e.acting_skill,
            "expression": e.expressiveness,
            "creativity": e.creativity,
            "teamwork": e.teamwork,
            "effort": e.effort,
        },
        "comment": e.comment,
        "ai_summary": e.ai_summary,
        "created_at": e.created_at,
    }


@router.get("/", response_model=List[EvaluationResponse])
def list_evaluations(
    student_id: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Evaluation).options(
        joinedload(Evaluation.student),
        joinedload(Evaluation.evaluator),
        joinedload(Evaluation.class_info)
    )
    if student_id:
        query = query.filter(Evaluation.student_id == student_id)
    if class_id:
        query = query.filter(Evaluation.class_id == class_id)
    if subject:
        try:
            s = Subject(subject)
            query = query.filter(Evaluation.subject == s)
        except ValueError:
            pass
    if period:
        query = query.filter(Evaluation.period == period)
    evals = query.order_by(Evaluation.created_at.desc()).all()
    return [evaluation_to_response(e) for e in evals]


@router.get("/report/{student_id}")
def get_student_report(student_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    evals = (
        db.query(Evaluation)
        .options(joinedload(Evaluation.evaluator), joinedload(Evaluation.class_info))
        .filter(Evaluation.student_id == student_id)
        .order_by(Evaluation.created_at.asc())
        .all()
    )

    eval_data = []
    for e in evals:
        eval_data.append({
            "period": e.period,
            "class": e.class_info.name if e.class_info else "",
            "subject": e.subject.value if e.subject else "acting",
            "acting_skill": e.acting_skill,
            "expressiveness": e.expressiveness,
            "creativity": e.creativity,
            "teamwork": e.teamwork,
            "effort": e.effort,
            "comment": e.comment or "",
        })

    ai_report = None
    if eval_data:
        import json
        ai_report = generate_evaluation_summary(json.dumps(eval_data, ensure_ascii=False))

    return {
        "student_id": student_id,
        "student_name": student.name,
        "evaluations": [evaluation_to_response(e) for e in evals],
        "ai_report": ai_report,
    }


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
def get_evaluation(evaluation_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = (
        db.query(Evaluation)
        .options(joinedload(Evaluation.student), joinedload(Evaluation.evaluator), joinedload(Evaluation.class_info))
        .filter(Evaluation.id == evaluation_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return evaluation_to_response(e)


@router.post("/", response_model=EvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    data: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    evaluation = Evaluation(
        id=f"eval{uuid.uuid4().hex[:7]}",
        student_id=data.student_id,
        evaluator_id=current_user.id,
        class_id=data.class_id,
        subject=data.subject,
        period=data.period,
        acting_skill=data.scores.acting,
        expressiveness=data.scores.expression,
        creativity=data.scores.creativity,
        teamwork=data.scores.teamwork,
        effort=data.scores.effort,
        comment=data.comment,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    await notify_user(
        db, data.student_id,
        f"새 평가가 등록되었습니다. ({data.period})",
        entity="evaluations",
    )

    e = (
        db.query(Evaluation)
        .options(joinedload(Evaluation.student), joinedload(Evaluation.evaluator), joinedload(Evaluation.class_info))
        .filter(Evaluation.id == evaluation.id)
        .first()
    )
    return evaluation_to_response(e)


@router.put("/{evaluation_id}", response_model=EvaluationResponse)
async def update_evaluation(
    evaluation_id: str,
    update_data: EvaluationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    e = (
        db.query(Evaluation)
        .options(joinedload(Evaluation.student), joinedload(Evaluation.evaluator), joinedload(Evaluation.class_info))
        .filter(Evaluation.id == evaluation_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    scores = update_dict.pop("scores", None)
    if scores:
        e.acting_skill = scores["acting"]
        e.expressiveness = scores["expression"]
        e.creativity = scores["creativity"]
        e.teamwork = scores["teamwork"]
        e.effort = scores["effort"]
    for field, value in update_dict.items():
        setattr(e, field, value)

    db.commit()
    db.refresh(e)

    await notify_user(
        db, e.student_id,
        f"평가가 수정되었습니다. ({e.period})",
        entity="evaluations",
    )

    return evaluation_to_response(e)


@router.post("/{evaluation_id}/ai-summary")
def generate_ai_summary(
    evaluation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    e = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    import json
    eval_data = json.dumps({
        "acting_skill": e.acting_skill,
        "expressiveness": e.expressiveness,
        "creativity": e.creativity,
        "teamwork": e.teamwork,
        "effort": e.effort,
        "comment": e.comment or "",
    }, ensure_ascii=False)

    summary = generate_evaluation_summary(eval_data)
    e.ai_summary = summary
    db.commit()
    return {"ai_summary": summary}


@router.delete("/{evaluation_id}")
async def delete_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    e = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    student_id = e.student_id
    db.delete(e)
    db.commit()

    await emit_data_changed([student_id], "evaluations")

    return {"message": "Evaluation deleted"}
