from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate, PasswordChange
from app.utils.auth import get_current_user, verify_password, get_password_hash
from app.services.notification_service import emit_data_changed, get_all_user_ids, get_teacher_student_ids
from app.services.account_deletion import purge_user_data, purge_user_files

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
def list_users(
    role: Optional[str] = Query(None, description="Filter by role: student, teacher, director"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # enrolled_class_ids(@property)가 직렬화 시 enrolled_classes 지연쿼리를 사용자마다 1회씩
    # 날려 1+N 문제가 됨 → selectinload로 한 번에 적재(1+N → 2쿼리, 출력 동일).
    query = db.query(User).options(selectinload(User.enrolled_classes))
    # Student: only themselves (no enumerating other users / PII)
    if current_user.role == UserRole.STUDENT:
        query = query.filter(User.id == current_user.id)
    # Teacher: only see students in their classes (+ self)
    elif current_user.role == UserRole.TEACHER:
        my_student_ids = get_teacher_student_ids(db, current_user.id)
        visible_ids = set(my_student_ids) | {current_user.id}
        query = query.filter(User.id.in_(visible_ids))
    if role:
        try:
            user_role = UserRole(role)
            query = query.filter(User.role == user_role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    return query.all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Student: only their own profile (no fetching others by id / PII)
    if current_user.role == UserRole.STUDENT and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    # Teachers can only see students in their classes + self
    if current_user.role == UserRole.TEACHER and user_id != current_user.id:
        visible_ids = set(get_teacher_student_ids(db, current_user.id))
        if user_id not in visible_ids:
            raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me/password")
def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "비밀번호가 변경되었습니다."}


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.id != user_id and current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    all_ids = get_all_user_ids(db)
    if all_ids:
        await emit_data_changed(all_ids, "users")

    return user


# 본인 계정 삭제 — /{user_id} 보다 먼저 정의(경로 충돌 방지). 앱스토어 인앱 계정삭제 요건.
@router.delete("/me")
async def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """로그인한 본인 계정과 모든 연관 데이터·파일을 영구 삭제한다(복구 불가)."""
    uid = current_user.id
    all_ids = get_all_user_ids(db)
    purge_user_data(db, uid)
    db.commit()
    purge_user_files(uid)  # DB 커밋 후 파일 정리(실패해도 삭제는 이미 확정)

    remaining_ids = [x for x in all_ids if x != uid]
    if remaining_ids:
        await emit_data_changed(remaining_ids, "users")
    return {"message": "Account deleted"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="Only directors can delete users")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    all_ids = get_all_user_ids(db)
    # 기존 db.delete(user)는 cascade 미커버 테이블(point_ledger·submissions 등)에서 FK 위반 →
    # 완전삭제 퍼지로 전 연관 데이터·파일까지 안전 제거.
    purge_user_data(db, user_id)
    db.commit()
    purge_user_files(user_id)

    remaining_ids = [uid for uid in all_ids if uid != user_id]
    if remaining_ids:
        await emit_data_changed(remaining_ids, "users")

    return {"message": "User deleted"}
