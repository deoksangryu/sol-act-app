from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.class_info import ClassInfo, class_students
from app.models.lesson import Lesson, LessonStatus, LessonType, Subject
from app.models.user import User, UserRole
from app.schemas.class_info import ClassInfoCreate, ClassInfoUpdate, ClassInfoResponse
from app.utils.auth import get_current_user
from app.services.notification_service import notify_user, emit_data_changed
from app.models.notification import NotificationType
from datetime import date, timedelta
import uuid

DAY_KO_MAP = {'월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6}
WEEKS_AHEAD = 4


def generate_lessons_for_class(cls: ClassInfo, db: Session) -> int:
    """클래스 schedule을 기반으로 향후 WEEKS_AHEAD주 수업을 자동 생성."""
    schedule = cls.schedule
    if not isinstance(schedule, list) or not schedule:
        return 0

    today = date.today()
    created = 0

    for slot in schedule:
        day_name = slot.get('day')
        start_time = slot.get('start_time') or slot.get('startTime')
        end_time = slot.get('end_time') or slot.get('endTime')

        if day_name not in DAY_KO_MAP or not start_time or not end_time:
            continue

        target_weekday = DAY_KO_MAP[day_name]
        days_ahead = (target_weekday - today.weekday()) % 7
        first_date = today + timedelta(days=days_ahead)

        # subject_teachers에서 첫 번째 과목/선생님 사용
        teacher_id = None
        subject = Subject.ACTING
        if cls.subject_teachers:
            for subj, tid in cls.subject_teachers.items():
                if tid:
                    teacher_id = tid
                    try:
                        subject = Subject(subj)
                    except ValueError:
                        pass
                    break

        for week in range(WEEKS_AHEAD):
            lesson_date = first_date + timedelta(weeks=week)
            lesson = Lesson(
                id=f"lsn{uuid.uuid4().hex[:7]}",
                class_id=cls.id,
                date=lesson_date,
                start_time=start_time,
                end_time=end_time,
                teacher_id=teacher_id,
                subject=subject,
                status=LessonStatus.SCHEDULED,
                lesson_type=LessonType.REGULAR,
            )
            db.add(lesson)
            created += 1

    return created

router = APIRouter()


def class_to_response(cls: ClassInfo) -> dict:
    return {
        "id": cls.id,
        "name": cls.name,
        "description": cls.description,
        "subject_teachers": cls.subject_teachers or {},
        "schedule": cls.schedule,
        "student_ids": [s.id for s in cls.students],
    }


@router.get("/", response_model=List[ClassInfoResponse])
def list_classes(
    teacher_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ClassInfo)
    if student_id:
        query = query.filter(ClassInfo.students.any(User.id == student_id))
    classes = query.all()
    # Teacher: only see their own classes
    if current_user.role == UserRole.TEACHER:
        classes = [c for c in classes if current_user.id in (c.subject_teachers or {}).values()]
    elif teacher_id:
        classes = [c for c in classes if teacher_id in (c.subject_teachers or {}).values()]
    return [class_to_response(c) for c in classes]


@router.get("/{class_id}", response_model=ClassInfoResponse)
def get_class(class_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return class_to_response(cls)


@router.post("/", response_model=ClassInfoResponse, status_code=status.HTTP_201_CREATED)
async def create_class(
    data: ClassInfoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    new_class = ClassInfo(
        id=f"cls{uuid.uuid4().hex[:7]}",
        name=data.name,
        description=data.description,
        subject_teachers=data.subject_teachers,
        schedule=[s.model_dump() for s in data.schedule],
    )
    if data.student_ids:
        students = db.query(User).filter(User.id.in_(data.student_ids)).all()
        new_class.students = students

    db.add(new_class)
    db.commit()
    db.refresh(new_class)

    generated = generate_lessons_for_class(new_class, db)
    if generated:
        db.commit()

    await emit_data_changed([current_user.id], "classes")
    await emit_data_changed([current_user.id], "lessons")

    resp = class_to_response(new_class)
    resp["generated_lessons_count"] = generated
    return resp


@router.put("/{class_id}", response_model=ClassInfoResponse)
async def update_class(
    class_id: str,
    update_data: ClassInfoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    update_dict = update_data.model_dump(exclude_unset=True)
    student_ids = update_dict.pop("student_ids", None)
    # Convert ScheduleSlot list to plain dicts for JSON storage
    if "schedule" in update_dict and isinstance(update_dict["schedule"], list):
        update_dict["schedule"] = [s if isinstance(s, dict) else s for s in update_dict["schedule"]]

    for field, value in update_dict.items():
        setattr(cls, field, value)

    if student_ids is not None:
        students = db.query(User).filter(User.id.in_(student_ids)).all()
        cls.students = students

    db.commit()
    db.refresh(cls)

    # schedule이 변경된 경우 미래 예정 수업 재생성
    generated = 0
    if "schedule" in update_dict:
        today = date.today()
        db.query(Lesson).filter(
            Lesson.class_id == class_id,
            Lesson.date >= today,
            Lesson.status == LessonStatus.SCHEDULED,
        ).delete()
        db.commit()
        generated = generate_lessons_for_class(cls, db)
        if generated:
            db.commit()

    member_ids = [s.id for s in cls.students]
    if cls.subject_teachers:
        member_ids.extend([tid for tid in cls.subject_teachers.values() if tid])
    if member_ids:
        await emit_data_changed(list(set(member_ids)), "classes")
        await emit_data_changed(list(set(member_ids)), "lessons")

    resp = class_to_response(cls)
    resp["generated_lessons_count"] = generated
    return resp


@router.delete("/{class_id}")
async def delete_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    member_ids = [s.id for s in cls.students]
    if cls.subject_teachers:
        member_ids.extend([tid for tid in cls.subject_teachers.values() if tid])

    db.delete(cls)
    db.commit()

    if member_ids:
        await emit_data_changed(list(set(member_ids)), "classes")

    return {"message": "Class deleted"}


class AddStudentRequest(BaseModel):
    student_id: str


@router.post("/{class_id}/students", response_model=ClassInfoResponse)
async def add_student(
    class_id: str,
    data: AddStudentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
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
        member_ids = [s.id for s in cls.students]
        if cls.subject_teachers:
            member_ids.extend([tid for tid in cls.subject_teachers.values() if tid])
        await emit_data_changed(list(set(member_ids)), "classes")
        await notify_user(
            db, data.student_id,
            f"'{cls.name}' 클래스에 등록되었습니다.",
            entity="classes",
        )

    return class_to_response(cls)


@router.delete("/{class_id}/students/{student_id}", response_model=ClassInfoResponse)
async def remove_student(
    class_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    cls = db.query(ClassInfo).filter(ClassInfo.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    student = db.query(User).filter(User.id == student_id).first()
    if student and student in cls.students:
        cls.students.remove(student)
        db.commit()
        db.refresh(cls)
        member_ids = [s.id for s in cls.students] + [student_id]
        if cls.subject_teachers:
            member_ids.extend([tid for tid in cls.subject_teachers.values() if tid])
        await emit_data_changed(list(set(member_ids)), "classes")
        await notify_user(
            db, student_id,
            f"'{cls.name}' 클래스에서 제외되었습니다.",
            NotificationType.WARNING,
            entity="classes",
        )

    return class_to_response(cls)
