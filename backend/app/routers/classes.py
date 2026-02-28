from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.class_info import ClassInfo, class_students
from app.models.user import User, UserRole
from app.schemas.class_info import ClassInfoCreate, ClassInfoUpdate, ClassInfoResponse
from app.utils.auth import get_current_user
import uuid

router = APIRouter()


def class_to_response(cls: ClassInfo) -> dict:
    return {
        "id": cls.id,
        "name": cls.name,
        "description": cls.description,
        "teacher_id": cls.teacher_id,
        "schedule": cls.schedule,
        "student_ids": [s.id for s in cls.students],
    }


@router.get("/", response_model=List[ClassInfoResponse])
def list_classes(
    teacher_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ClassInfo)
    if teacher_id:
        query = query.filter(ClassInfo.teacher_id == teacher_id)
    if student_id:
        query = query.filter(ClassInfo.students.any(User.id == student_id))
    classes = query.all()
    return [class_to_response(c) for c in classes]


@router.get("/{class_id}", response_model=ClassInfoResponse)
def get_class(class_id: str, db: Session = Depends(get_db)):
    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return class_to_response(cls)


@router.post("/", response_model=ClassInfoResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    data: ClassInfoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    new_class = ClassInfo(
        id=f"cls{uuid.uuid4().hex[:7]}",
        name=data.name,
        description=data.description,
        teacher_id=data.teacher_id,
        schedule=data.schedule,
    )
    if data.student_ids:
        students = db.query(User).filter(User.id.in_(data.student_ids)).all()
        new_class.students = students

    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return class_to_response(new_class)


@router.put("/{class_id}", response_model=ClassInfoResponse)
def update_class(
    class_id: str,
    update_data: ClassInfoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    student_ids = update_dict.pop("student_ids", None)

    for field, value in update_dict.items():
        setattr(cls, field, value)

    if student_ids is not None:
        students = db.query(User).filter(User.id.in_(student_ids)).all()
        cls.students = students

    db.commit()
    db.refresh(cls)
    return class_to_response(cls)


@router.delete("/{class_id}")
def delete_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    db.delete(cls)
    db.commit()
    return {"message": "Class deleted"}


class AddStudentRequest(BaseModel):
    student_id: str


@router.post("/{class_id}/students", response_model=ClassInfoResponse)
def add_student(
    class_id: str,
    data: AddStudentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    student = db.query(User).filter(User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student not in cls.students:
        cls.students.append(student)
        db.commit()
        db.refresh(cls)

    return class_to_response(cls)


@router.delete("/{class_id}/students/{student_id}", response_model=ClassInfoResponse)
def remove_student(
    class_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    student = db.query(User).filter(User.id == student_id).first()
    if student and student in cls.students:
        cls.students.remove(student)
        db.commit()
        db.refresh(cls)

    return class_to_response(cls)
