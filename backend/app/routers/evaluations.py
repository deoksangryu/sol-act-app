from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.evaluation import Evaluation
from app.models.user import User, UserRole
from app.models.class_info import ClassInfo
from app.schemas.evaluation import EvaluationCreate, EvaluationUpdate, EvaluationResponse
from app.utils.auth import get_current_user
from app.services.ai import generate_evaluation_summary
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
        "period": e.period,
        "acting_skill": e.acting_skill,
        "expressiveness": e.expressiveness,
        "teamwork": e.teamwork,
        "effort": e.effort,
        "attendance_score": e.attendance_score,
        "comment": e.comment,
        "ai_summary": e.ai_summary,
        "created_at": e.created_at,
    }


@router.get("/", response_model=List[EvaluationResponse])
def list_evaluations(
    student_id: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db)
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
    if period:
        query = query.filter(Evaluation.period == period)
    evals = query.order_by(Evaluation.created_at.desc()).all()
    return [evaluation_to_response(e) for e in evals]


# /report/{student_id} must be before /{id}
@router.get("/report/{student_id}")
def get_student_report(student_id: str, db: Session = Depends(get_db)):
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
            "acting_skill": e.acting_skill,
            "expressiveness": e.expressiveness,
            "teamwork": e.teamwork,
            "effort": e.effort,
            "attendance_score": e.attendance_score,
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
def get_evaluation(evaluation_id: str, db: Session = Depends(get_db)):
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
def create_evaluation(
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
        period=data.period,
        acting_skill=data.acting_skill,
        expressiveness=data.expressiveness,
        teamwork=data.teamwork,
        effort=data.effort,
        attendance_score=data.attendance_score,
        comment=data.comment,
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)
    e = (
        db.query(Evaluation)
        .options(joinedload(Evaluation.student), joinedload(Evaluation.evaluator), joinedload(Evaluation.class_info))
        .filter(Evaluation.id == evaluation.id)
        .first()
    )
    return evaluation_to_response(e)


@router.put("/{evaluation_id}", response_model=EvaluationResponse)
def update_evaluation(
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

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(e, field, value)

    db.commit()
    db.refresh(e)
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
        "teamwork": e.teamwork,
        "effort": e.effort,
        "attendance_score": e.attendance_score,
        "comment": e.comment or "",
    }, ensure_ascii=False)

    summary = generate_evaluation_summary(eval_data)
    e.ai_summary = summary
    db.commit()
    return {"ai_summary": summary}


@router.delete("/{evaluation_id}")
def delete_evaluation(
    evaluation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    e = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    db.delete(e)
    db.commit()
    return {"message": "Evaluation deleted"}
