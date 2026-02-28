from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.diet import DietLog
from app.models.user import User
from app.schemas.diet import DietLogCreate, DietLogUpdate, DietLogResponse
from app.services.ai import analyze_diet as ai_analyze_diet
import uuid

router = APIRouter()


def diet_to_response(d: DietLog) -> dict:
    return {
        "id": d.id,
        "student_id": d.student_id,
        "student_name": d.student.name if d.student else "",
        "date": d.date,
        "meal_type": d.meal_type,
        "description": d.description,
        "calories": d.calories,
        "ai_advice": d.ai_advice,
        "image_url": d.image_url,
        "created_at": d.created_at,
    }


@router.get("/", response_model=List[DietLogResponse])
def list_diet_logs(
    student_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    query = db.query(DietLog).options(joinedload(DietLog.student))
    if student_id:
        query = query.filter(DietLog.student_id == student_id)
    if date:
        from datetime import datetime
        try:
            target = datetime.strptime(date, "%Y-%m-%d")
            next_day = target.replace(hour=23, minute=59, second=59)
            query = query.filter(DietLog.date >= target, DietLog.date <= next_day)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    logs = query.order_by(DietLog.date.desc()).all()
    return [diet_to_response(d) for d in logs]


class DietAnalyzeRequest(BaseModel):
    description: str
    image_base64: Optional[str] = None


# /analyze must be defined BEFORE /{id} to avoid path conflict
@router.post("/analyze")
def analyze_diet_endpoint(data: DietAnalyzeRequest):
    result = ai_analyze_diet(data.description, data.image_base64)
    return result


@router.post("/", response_model=DietLogResponse, status_code=status.HTTP_201_CREATED)
def create_diet_log(data: DietLogCreate, db: Session = Depends(get_db)):
    student = db.query(User).filter(User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    log = DietLog(
        id=f"diet{uuid.uuid4().hex[:7]}",
        student_id=data.student_id,
        date=data.date,
        meal_type=data.meal_type,
        description=data.description,
        image_url=data.image_url,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    d = db.query(DietLog).options(joinedload(DietLog.student)).filter(DietLog.id == log.id).first()
    return diet_to_response(d)


@router.put("/{diet_id}", response_model=DietLogResponse)
def update_diet_log(diet_id: str, update_data: DietLogUpdate, db: Session = Depends(get_db)):
    d = db.query(DietLog).options(joinedload(DietLog.student)).filter(DietLog.id == diet_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Diet log not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(d, field, value)

    db.commit()
    db.refresh(d)
    return diet_to_response(d)


@router.delete("/{diet_id}")
def delete_diet_log(diet_id: str, db: Session = Depends(get_db)):
    d = db.query(DietLog).filter(DietLog.id == diet_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Diet log not found")

    db.delete(d)
    db.commit()
    return {"message": "Diet log deleted"}
