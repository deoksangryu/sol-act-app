from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.assignment import Assignment, AssignmentStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate, AssignmentResponse
from app.utils.auth import get_current_user
from app.services.ai import analyze_monologue
from app.models.class_info import ClassInfo
from app.services.notification_service import notify_user, notify_users, emit_data_changed, get_teacher_ids_for_student, get_teacher_student_ids, get_class_student_ids
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
        "attachment_url": a.attachment_url,
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
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Assignment).options(joinedload(Assignment.student))
    # Teacher: only see assignments for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        query = query.filter(Assignment.student_id.in_(my_student_ids))
    # Student: only see own assignments
    elif current_user.role == UserRole.STUDENT:
        query = query.filter(Assignment.student_id == current_user.id)
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
    assignments = query.order_by(Assignment.due_date.desc()).offset(skip).limit(limit).all()
    return [assignment_to_response(a) for a in assignments]


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    # Student: can only view own assignments
    if current_user.role == UserRole.STUDENT and a.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    # Teacher: can only view assignments for students in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        if a.student_id not in my_student_ids:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    return assignment_to_response(a)


@router.post("/", response_model=List[AssignmentResponse], status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Only teachers and directors can create assignments")

    # Resolve target student IDs: class_id > student_ids > student_id
    target_ids: List[str] = []
    if data.class_id:
        target_ids = get_class_student_ids(db, data.class_id)
    elif data.student_ids:
        target_ids = data.student_ids
    elif data.student_id:
        target_ids = [data.student_id]
    if not target_ids:
        raise HTTPException(status_code=400, detail="No target students specified")

    # Teacher: validate all targets are in their classes
    if current_user.role == UserRole.TEACHER:
        my_student_ids = set(get_teacher_student_ids(db, current_user.id))
        invalid = [sid for sid in target_ids if sid not in my_student_ids]
        if invalid:
            raise HTTPException(status_code=403, detail="Cannot assign to students outside your classes")

    assignments = []
    for sid in target_ids:
        assignment = Assignment(
            id=f"asgn{uuid.uuid4().hex[:7]}",
            title=data.title,
            description=data.description,
            due_date=data.due_date,
            student_id=sid,
            assigned_by=current_user.id,
            status=AssignmentStatus.PENDING,
            attachment_url=data.attachment_url,
        )
        db.add(assignment)
        assignments.append(assignment)
    db.commit()

    await notify_users(
        db, target_ids,
        f"새 과제가 등록되었습니다: '{data.title}'",
        entity="assignments",
    )
    await emit_data_changed([current_user.id], "assignments")

    result = []
    for assignment in assignments:
        a = db.query(Assignment).options(joinedload(Assignment.student)).filter(Assignment.id == assignment.id).first()
        result.append(assignment_to_response(a))
    return result


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

    await notify_user(
        db, a.student_id,
        f"과제가 수정되었습니다: '{a.title}'",
        entity="assignments",
    )

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

    if a.status == AssignmentStatus.GRADED:
        raise HTTPException(status_code=400, detail="Cannot resubmit a graded assignment")

    a.submission_text = data.submission_text
    if data.submission_file_url:
        a.submission_file_url = data.submission_file_url
    a.status = AssignmentStatus.SUBMITTED

    db.commit()
    db.refresh(a)

    # Notify teachers about submission
    teacher_ids = get_teacher_ids_for_student(db, a.student_id)
    student_name = a.student.name if a.student else "학생"
    await notify_users(
        db, teacher_ids,
        f"{student_name}님이 과제 '{a.title}'을 제출했습니다.",
        entity="assignments",
    )

    return assignment_to_response(a)


@router.patch("/{assignment_id}/file", response_model=AssignmentResponse)
async def patch_submission_file(
    assignment_id: str,
    file_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Patch the submission file URL after an async upload completes.

    Called when a background upload finishes after the initial submission.
    Does not change status or re-notify teachers.
    """
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.id != a.student_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    a.submission_file_url = file_url
    db.commit()
    db.refresh(a)
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

    if a.status == AssignmentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Cannot grade an assignment that has not been submitted")

    a.grade = data.grade
    a.feedback = data.feedback
    a.status = AssignmentStatus.GRADED

    db.commit()
    db.refresh(a)

    # Notify student about grading
    await notify_user(
        db, a.student_id,
        f"과제 '{a.title}'이 채점되었습니다. 등급: {data.grade}",
        NotificationType.SUCCESS,
        entity="assignments",
    )

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

    # Only the student themselves or teacher/director can trigger analysis
    if current_user.role == UserRole.STUDENT and a.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

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
