from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.notice import Notice
from app.models.user import User, UserRole
from app.schemas.notice import NoticeCreate, NoticeUpdate, NoticeResponse
from app.utils.auth import get_current_user
from app.services.notification_service import notify_users, get_all_student_ids, get_class_student_ids, get_teacher_class_ids, emit_data_changed, validate_class_access
import uuid

router = APIRouter()


def _notice_targets(n: Notice) -> List[str]:
    """공지 대상 반 = target_class_ids(신규) ∪ class_id(legacy). 비면 전체 공지."""
    targets = list(n.target_class_ids or [])
    if n.class_id and n.class_id not in targets:
        targets.append(n.class_id)
    return targets


def _can_view_notice(db: Session, n: Notice, user: User) -> bool:
    """수신 대상만 열람: 원장=전체 / 그 외=전체 공지 또는 본인이 속·담당한 반 공지."""
    if user.role == UserRole.DIRECTOR:
        return True
    targets = _notice_targets(n)
    return (not targets) or any(validate_class_access(db, cid, user) for cid in targets)


def _ensure_can_manage(db: Session, n: Notice, user: User) -> None:
    """수정·삭제 권한: 원장=전체 / 교사=본인 담당 반 공지만(전체 공지는 불가)."""
    if user.role == UserRole.DIRECTOR:
        return
    targets = _notice_targets(n)
    if not targets:
        raise HTTPException(status_code=403, detail="전체 공지는 원장만 관리할 수 있어요")
    my_classes = set(get_teacher_class_ids(db, user.id))
    if any(cid not in my_classes for cid in targets):
        raise HTTPException(status_code=403, detail="담당 반 공지만 관리할 수 있어요")


@router.get("/", response_model=List[NoticeResponse])
def list_notices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notices = db.query(Notice).order_by(Notice.created_at.desc()).all()
    # 원장: 전체 / 학생·교사: 전체 공지(대상 없음) + 본인이 속·담당한 반 공지만
    if current_user.role == UserRole.DIRECTOR:
        return notices
    access_cache: dict = {}
    def can_access(cid: str) -> bool:
        if cid not in access_cache:
            access_cache[cid] = validate_class_access(db, cid, current_user)
        return access_cache[cid]
    visible = []
    for n in notices:
        targets = _notice_targets(n)
        if not targets or any(can_access(cid) for cid in targets):
            visible.append(n)
    return visible


@router.get("/{notice_id}", response_model=NoticeResponse)
def get_notice(notice_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    # 수신 대상이 아니면 존재 자체를 숨김(404) — IDOR 방지
    if not _can_view_notice(db, notice, current_user):
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice


@router.post("/", response_model=NoticeResponse, status_code=status.HTTP_201_CREATED)
async def create_notice(
    data: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Only teachers and directors can create notices")

    # 대상 반: target_class_ids(신규) ∪ class_id(legacy). 비면 전체 공지.
    targets = list(data.target_class_ids or [])
    if data.class_id and data.class_id not in targets:
        targets.append(data.class_id)

    # 교사: 본인 담당 반만, 최소 1개 지정
    if current_user.role == UserRole.TEACHER:
        if not targets:
            raise HTTPException(status_code=400, detail="선생님은 공지 대상 반을 지정해야 해요")
        my_classes = set(get_teacher_class_ids(db, current_user.id))
        if any(cid not in my_classes for cid in targets):
            raise HTTPException(status_code=403, detail="담당 반에만 공지할 수 있어요")

    notice = Notice(
        id=f"notice{uuid.uuid4().hex[:7]}",
        title=data.title,
        content=data.content,
        author=data.author,
        important=data.important,
        class_id=None,
        target_class_ids=(targets or None),
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)

    # 알림: 대상 반들의 학생 합집합 / 대상 없으면 전체 학생
    if targets:
        ids = set()
        for cid in targets:
            ids.update(get_class_student_ids(db, cid))
        student_ids = list(ids)
    else:
        student_ids = get_all_student_ids(db)
    if student_ids:
        await notify_users(
            db, student_ids,
            f"새 공지사항: {data.title}",
            entity="notices",
        )
    await emit_data_changed([current_user.id], "notices")

    return notice


@router.put("/{notice_id}", response_model=NoticeResponse)
async def update_notice(
    notice_id: str,
    update_data: NoticeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    # 교사는 본인 담당 반 공지만 수정 가능(현재 대상 기준)
    _ensure_can_manage(db, notice, current_user)

    new_fields = update_data.model_dump(exclude_unset=True)
    # 교사가 대상 반을 바꾸려 하면 새 대상도 본인 담당 반만 허용(전체 공지화 금지)
    if current_user.role == UserRole.TEACHER and "target_class_ids" in new_fields:
        new_targets = list(new_fields.get("target_class_ids") or [])
        my_classes = set(get_teacher_class_ids(db, current_user.id))
        if not new_targets or any(cid not in my_classes for cid in new_targets):
            raise HTTPException(status_code=403, detail="담당 반에만 공지할 수 있어요")

    for field, value in new_fields.items():
        setattr(notice, field, value)

    db.commit()
    db.refresh(notice)

    # 알림: 현재 대상 반들의 학생 합집합 / 대상 없으면 전체
    targets = _notice_targets(notice)
    if targets:
        ids = set()
        for cid in targets:
            ids.update(get_class_student_ids(db, cid))
        student_ids = list(ids)
    else:
        student_ids = get_all_student_ids(db)
    if student_ids:
        await notify_users(
            db, student_ids,
            f"공지사항이 수정되었습니다: {notice.title}",
            entity="notices",
        )

    return notice


@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")

    # 교사는 본인 담당 반 공지만 삭제 가능
    _ensure_can_manage(db, notice, current_user)

    student_ids = get_all_student_ids(db)

    db.delete(notice)
    db.commit()

    if student_ids:
        await emit_data_changed(student_ids, "notices")

    return {"message": "Notice deleted"}
