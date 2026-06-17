from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date
from app.database import get_db
from app.models.plan import Plan, PlanItem, PlanType, week_start
from app.models.user import User, UserRole
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse, PlanItemToggle
from app.services.notification_service import (
    notify_user, notify_users, emit_data_changed,
    get_teacher_ids_for_student, get_teacher_student_ids,
)
from app.utils.auth import get_current_user
import uuid

router = APIRouter()


def plan_to_response(p: Plan) -> dict:
    items = sorted(p.items, key=lambda i: i.sort_order)
    total = len(items)
    done = sum(1 for i in items if i.done)
    return {
        "id": p.id,
        "student_id": p.student_id,
        "student_name": p.student.name if p.student else "",
        "plan_type": p.plan_type,
        "plan_date": p.plan_date,
        "teacher_comment": p.teacher_comment,
        "items": [
            {"id": i.id, "content": i.content, "done": i.done, "sort_order": i.sort_order}
            for i in items
        ],
        "total_count": total,
        "done_count": done,
        "progress": round(done / total * 100, 1) if total else 0.0,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


@router.get("/", response_model=List[PlanResponse])
def list_plans(
    student_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None, description="daily|weekly"),
    from_date: Optional[str] = Query(None, alias="from", description="범위 시작 YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, alias="to", description="범위 끝 YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Plan).options(joinedload(Plan.student), joinedload(Plan.items))
    if current_user.role == UserRole.STUDENT:
        query = query.filter(Plan.student_id == current_user.id)
    elif current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        if student_id and student_id in my_student_ids:
            query = query.filter(Plan.student_id == student_id)
        else:
            # 담당하지 않는 학생 id를 줘도 본인 담당 학생으로만 한정(IDOR 방지)
            query = query.filter(Plan.student_id.in_(my_student_ids))
    elif student_id:
        query = query.filter(Plan.student_id == student_id)

    if type:
        try:
            query = query.filter(Plan.plan_type == PlanType(type))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid type: {type}")

    def _parse(d: str) -> date:
        try:
            return datetime.strptime(d, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if from_date:
        query = query.filter(Plan.plan_date >= _parse(from_date))
    if to_date:
        query = query.filter(Plan.plan_date <= _parse(to_date))

    # 2차 정렬키로 같은 날짜 행의 순서를 안정화(새로고침마다 순서가 흔들리지 않도록)
    plans = query.order_by(
        Plan.plan_date.desc(), Plan.student_id, Plan.plan_type
    ).offset(skip).limit(limit).all()
    return [plan_to_response(p) for p in plans]


# /items/... must be defined BEFORE /{plan_id} to avoid path conflict
@router.patch("/items/{item_id}/toggle", response_model=PlanResponse)
async def toggle_item(
    item_id: str,
    data: PlanItemToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(PlanItem).filter(PlanItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Plan item not found")
    plan = db.query(Plan).options(joinedload(Plan.student), joinedload(Plan.items)).filter(
        Plan.id == item.plan_id
    ).first()
    if not plan or plan.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 계획만 수정할 수 있어요")

    item.done = data.done
    db.commit()
    db.refresh(plan)

    teacher_ids = get_teacher_ids_for_student(db, plan.student_id)
    if teacher_ids:
        await emit_data_changed(teacher_ids, "plans")

    return plan_to_response(plan)


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Plan).options(joinedload(Plan.student), joinedload(Plan.items)).filter(
        Plan.id == plan_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")
    if current_user.role == UserRole.STUDENT and p.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role == UserRole.TEACHER and p.student_id not in get_teacher_student_ids(db, current_user.id):
        raise HTTPException(status_code=403, detail="담당 학생의 계획만 볼 수 있어요")
    return plan_to_response(p)


@router.post("/", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: PlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = db.query(User).filter(User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role == UserRole.STUDENT and data.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="계획은 학생만 작성할 수 있어요")

    # 주간계획은 그 주 월요일로 정규화
    plan_date = week_start(data.plan_date) if data.plan_type == PlanType.WEEKLY else data.plan_date

    # 업서트: (학생, 타입, 날짜) 이미 있으면 그 계획을 이어서 편집
    existing = db.query(Plan).filter(
        Plan.student_id == data.student_id,
        Plan.plan_type == data.plan_type,
        Plan.plan_date == plan_date,
    ).first()
    is_new = existing is None

    if existing:
        plan = existing
    else:
        plan = Plan(
            id=f"plan{uuid.uuid4().hex[:7]}",
            student_id=data.student_id,
            plan_type=data.plan_type,
            plan_date=plan_date,
        )
        db.add(plan)
        db.flush()

    # 초기 항목 추가(업서트 시에도 보낸 항목을 추가)
    for idx, it in enumerate(data.items):
        db.add(PlanItem(
            id=f"pi{uuid.uuid4().hex[:8]}",
            plan_id=plan.id,
            content=it.content,
            sort_order=it.sort_order if it.sort_order else idx,
        ))
    db.commit()

    # 최초 작성 시에만 교사 알림(이후 편집/체크는 알림 없이 실시간 갱신만)
    teacher_ids = get_teacher_ids_for_student(db, data.student_id)
    if teacher_ids:
        if is_new:
            await notify_users(
                db, teacher_ids,
                f"{student.name}님이 학습 계획을 작성했어요.",
                entity="plans",
            )
        else:
            await emit_data_changed(teacher_ids, "plans")

    p = db.query(Plan).options(joinedload(Plan.student), joinedload(Plan.items)).filter(
        Plan.id == plan.id
    ).first()
    return plan_to_response(p)


@router.put("/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    update_data: PlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Plan).options(joinedload(Plan.student), joinedload(Plan.items)).filter(
        Plan.id == plan_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")

    is_student_owner = current_user.role == UserRole.STUDENT and p.student_id == current_user.id
    if current_user.role == UserRole.STUDENT and not is_student_owner:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role == UserRole.TEACHER and p.student_id not in get_teacher_student_ids(db, current_user.id):
        raise HTTPException(status_code=403, detail="담당 학생의 계획에만 피드백할 수 있어요")

    if current_user.role in (UserRole.TEACHER, UserRole.DIRECTOR):
        # 교사·원장: 코멘트만 수정 가능
        if update_data.teacher_comment is not None:
            p.teacher_comment = update_data.teacher_comment
        db.commit()
        db.refresh(p)
        if update_data.teacher_comment:
            await notify_user(db, p.student_id, "선생님이 계획에 코멘트를 남겼어요.", entity="plans")
        else:
            await emit_data_changed([p.student_id], "plans")
        return plan_to_response(p)

    # 학생-소유자: 체크리스트 항목 diff 갱신(done 보존)
    if update_data.items is not None:
        existing_by_id = {i.id: i for i in p.items}
        sent_ids = set()
        for idx, it in enumerate(update_data.items):
            order = it.sort_order if it.sort_order else idx
            if it.id and it.id in existing_by_id:
                row = existing_by_id[it.id]
                row.content = it.content
                row.sort_order = order
                if it.done is not None:
                    row.done = it.done
                sent_ids.add(it.id)
            else:
                db.add(PlanItem(
                    id=f"pi{uuid.uuid4().hex[:8]}",
                    plan_id=p.id,
                    content=it.content,
                    done=bool(it.done),
                    sort_order=order,
                ))
        # 목록에서 빠진 기존 항목 삭제
        for old_id, row in existing_by_id.items():
            if old_id not in sent_ids:
                db.delete(row)

    db.commit()
    db.refresh(p)

    teacher_ids = get_teacher_ids_for_student(db, p.student_id)
    if teacher_ids:
        await emit_data_changed(teacher_ids, "plans")

    return plan_to_response(p)


@router.delete("/{plan_id}")
async def delete_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Plan).filter(Plan.id == plan_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plan not found")
    if current_user.role == UserRole.STUDENT and p.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role == UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Teachers cannot delete student plans")

    student_id = p.student_id
    db.delete(p)
    db.commit()

    teacher_ids = get_teacher_ids_for_student(db, student_id)
    if teacher_ids:
        await emit_data_changed(teacher_ids, "plans")

    return {"message": "Plan deleted"}
