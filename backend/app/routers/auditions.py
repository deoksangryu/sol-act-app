from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.audition import Audition, AuditionChecklist, AuditionType, AuditionStatus
from app.models.user import User, UserRole
from app.schemas.audition import (
    AuditionCreate, AuditionUpdate, AuditionResponse,
    ChecklistCreate, ChecklistUpdate, ChecklistResponse
)
from app.utils.auth import get_current_user
from app.services.ai import generate_audition_tips
import uuid

router = APIRouter()


def audition_to_response(a: Audition) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "date": a.date,
        "location": a.location,
        "audition_type": a.audition_type,
        "status": a.status,
        "creator_id": a.creator_id,
        "creator_name": a.creator.name if a.creator else "",
        "class_id": a.class_id,
        "checklists": [
            {
                "id": c.id,
                "content": c.content,
                "is_checked": c.is_checked,
                "sort_order": c.sort_order,
            }
            for c in a.checklists
        ],
        "created_at": a.created_at,
    }


@router.get("/", response_model=List[AuditionResponse])
def list_auditions(
    creator_id: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db)
):
    query = db.query(Audition).options(
        joinedload(Audition.creator), joinedload(Audition.checklists)
    )
    if creator_id:
        query = query.filter(Audition.creator_id == creator_id)
    if class_id:
        query = query.filter(Audition.class_id == class_id)
    if status_filter:
        try:
            s = AuditionStatus(status_filter)
            query = query.filter(Audition.status == s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_filter}")
    if type_filter:
        try:
            t = AuditionType(type_filter)
            query = query.filter(Audition.audition_type == t)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid type: {type_filter}")
    auditions = query.order_by(Audition.date.asc()).all()
    return [audition_to_response(a) for a in auditions]


@router.get("/{audition_id}", response_model=AuditionResponse)
def get_audition(audition_id: str, db: Session = Depends(get_db)):
    a = (
        db.query(Audition)
        .options(joinedload(Audition.creator), joinedload(Audition.checklists))
        .filter(Audition.id == audition_id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Audition not found")
    return audition_to_response(a)


@router.post("/", response_model=AuditionResponse, status_code=status.HTTP_201_CREATED)
def create_audition(
    data: AuditionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    audition = Audition(
        id=f"aud{uuid.uuid4().hex[:7]}",
        title=data.title,
        description=data.description,
        date=data.date,
        location=data.location,
        audition_type=data.audition_type,
        creator_id=current_user.id,
        class_id=data.class_id,
    )
    db.add(audition)
    db.commit()
    db.refresh(audition)
    a = (
        db.query(Audition)
        .options(joinedload(Audition.creator), joinedload(Audition.checklists))
        .filter(Audition.id == audition.id)
        .first()
    )
    return audition_to_response(a)


@router.put("/{audition_id}", response_model=AuditionResponse)
def update_audition(
    audition_id: str,
    update_data: AuditionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = (
        db.query(Audition)
        .options(joinedload(Audition.creator), joinedload(Audition.checklists))
        .filter(Audition.id == audition_id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Audition not found")

    if current_user.id != a.creator_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)

    db.commit()
    db.refresh(a)
    return audition_to_response(a)


@router.post("/{audition_id}/checklists", response_model=ChecklistResponse, status_code=status.HTTP_201_CREATED)
def add_checklist(
    audition_id: str,
    data: ChecklistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Audition).filter(Audition.id == audition_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Audition not found")

    checklist = AuditionChecklist(
        id=f"achk{uuid.uuid4().hex[:7]}",
        audition_id=audition_id,
        content=data.content,
        sort_order=data.sort_order,
    )
    db.add(checklist)
    db.commit()
    db.refresh(checklist)
    return checklist


@router.put("/{audition_id}/checklists/{checklist_id}", response_model=ChecklistResponse)
def update_checklist(
    audition_id: str,
    checklist_id: str,
    update_data: ChecklistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(AuditionChecklist).filter(
        AuditionChecklist.id == checklist_id,
        AuditionChecklist.audition_id == audition_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)

    db.commit()
    db.refresh(c)
    return c


@router.delete("/{audition_id}/checklists/{checklist_id}")
def delete_checklist(
    audition_id: str,
    checklist_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(AuditionChecklist).filter(
        AuditionChecklist.id == checklist_id,
        AuditionChecklist.audition_id == audition_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    db.delete(c)
    db.commit()
    return {"message": "Checklist item deleted"}


@router.post("/{audition_id}/generate-tips")
def generate_tips(
    audition_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Audition).filter(Audition.id == audition_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Audition not found")

    tips = generate_audition_tips(a.title, a.description, a.audition_type.value)
    return {"tips": tips}


@router.delete("/{audition_id}")
def delete_audition(
    audition_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Audition).filter(Audition.id == audition_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Audition not found")

    if current_user.id != a.creator_id and current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    db.delete(a)
    db.commit()
    return {"message": "Audition deleted"}
