from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.assignment import Assignment, AssignmentStatus
from app.models.user import User, UserRole
from app.models.class_info import ClassInfo
from app.models.notification import Notification, NotificationType
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate, AssignmentResponse
from app.utils.auth import get_current_user
from app.services.ai import analyze_monologue
from app.services.websocket_manager import manager
from app.services.notification_service import notify_user, emit_data_changed
import uuid

router = APIRouter()


def assignment_to_response(a: Assignment) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "due_date": a.due_date,
        "student_id": a.student_id,
        "student_name": a.student.name if a.student else "",
        "status": a.status,
        "submission_text": a.submission_text,
        "submission_file_url": a.submission_file_url,
        "feedback": a.feedback,
        "ai_analysis": a.ai_analysis,
        "grade": a.grade,
        "assigned_by": a.assigned_by,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


@router.get("/", response_model=List[AssignmentResponse])
def list_assignments(
    student_id: Optional[str] = Query(None),
    assigned_by: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Assignment).options(joinedload(Assignment.student))
    if student_id:
        query = query.filter(Assignment.student_id == student_id)
    if assigned_by:
        query = query.filter(Assignment.assigned_by == assigned_by)
    if status_filter:
        try:
            s = AssignmentStatus(status_filter)
            query = query.filter(Assignment.status == s)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_filter}")
    assignments = query.order_by(Assignment.due_date.desc()).all()
    return [assignment_to_response(a) for a in assignments]


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(assignment_id: str, db: Session = Depends(get_db)):
    a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment_to_response(a)


@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Only teachers and directors can create assignments")

    student = db.query(User).filter(User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    assignment = Assignment(
        id=f"asgn{uuid.uuid4().hex[:7]}",
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        student_id=data.student_id,
        assigned_by=current_user.id,
        status=AssignmentStatus.PENDING,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    await notify_user(
        db, data.student_id,
        f"새 과제가 등록되었습니다: '{data.title}'",
        entity="assignments",
    )
    await emit_data_changed([current_user.id], "assignments")

    a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment.id).first()
    return assignment_to_response(a)


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: str,
    update_data: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)

    db.commit()
    db.refresh(a)

    await emit_data_changed([a.student_id], "assignments")

    return assignment_to_response(a)


class SubmissionData(BaseModel):
    submission_text: str
    submission_file_url: Optional[str] = None


@router.put("/{assignment_id}/submit", response_model=AssignmentResponse)
async def submit_assignment(
    assignment_id: str,
    data: SubmissionData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if current_user.id != a.student_id:
        raise HTTPException(status_code=403, detail="You can only submit your own assignments")

    a.submission_text = data.submission_text
    if data.submission_file_url:
        a.submission_file_url = data.submission_file_url
    a.status = AssignmentStatus.SUBMITTED

    db.commit()
    db.refresh(a)

    # Notify teachers about submission
    teacher_ids = set()
    classes = db.query(ClassInfo).all()
    for cls in classes:
        student_ids = [s.id for s in cls.students]
        if a.student_id in student_ids and cls.subject_teachers:
            for tid in cls.subject_teachers.values():
                if tid:
                    teacher_ids.add(tid)
    directors = db.query(User).filter(User.role == UserRole.DIRECTOR).all()
    for d in directors:
        teacher_ids.add(d.id)

    student_name = a.student.name if a.student else "학생"
    msg = f"{student_name}님이 과제 '{a.title}'을 제출했습니다."
    for tid in teacher_ids:
        notif = Notification(
            id=f"noti{uuid.uuid4().hex[:7]}",
            user_id=tid,
            type=NotificationType.INFO,
            message=msg,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        await manager.send_to_user(tid, {
            "type": "new_notification",
            "data": {
                "id": notif.id, "type": notif.type.value,
                "message": notif.message, "read": notif.read,
                "created_at": notif.created_at.isoformat(),
            },
        })
    await emit_data_changed(list(teacher_ids), "assignments")

    return assignment_to_response(a)


class GradeData(BaseModel):
    grade: str
    feedback: str


@router.put("/{assignment_id}/grade", response_model=AssignmentResponse)
async def grade_assignment(
    assignment_id: str,
    data: GradeData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Only teachers and directors can grade")

    a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    a.grade = data.grade
    a.feedback = data.feedback
    a.status = AssignmentStatus.GRADED

    db.commit()
    db.refresh(a)

    # Notify student about grading
    msg = f"과제 '{a.title}'이 채점되었습니다. 등급: {data.grade}"
    notif = Notification(
        id=f"noti{uuid.uuid4().hex[:7]}",
        user_id=a.student_id,
        type=NotificationType.SUCCESS,
        message=msg,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    await manager.send_to_user(a.student_id, {
        "type": "new_notification",
        "data": {
            "id": notif.id, "type": notif.type.value,
            "message": notif.message, "read": notif.read,
            "created_at": notif.created_at.isoformat(),
        },
    })
    await emit_data_changed([a.student_id], "assignments")

    return assignment_to_response(a)


@router.post("/{assignment_id}/analyze")
def analyze_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if not a.submission_text:
        raise HTTPException(status_code=400, detail="No submission to analyze")

    result = analyze_monologue(a.submission_text)
    a.ai_analysis = result
    db.commit()

    return {"ai_analysis": result}


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    student_id = a.student_id
    db.delete(a)
    db.commit()

    await emit_data_changed([student_id], "assignments")

    return {"message": "Assignment deleted"}
