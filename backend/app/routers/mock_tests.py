"""모의테스트 라우터 — 원장이 생성·순번지정·공지·영상배포, 학생이 음원업로드·본인영상조회.

업로드(학생 음원 / 원장 영상)는 기존 /api/upload 엔드포인트를 target_type으로 재사용한다:
  - 학생 음원: target_type="mock_test_audio",  target_id="{mock_test_id}"
  - 원장 영상: target_type="mock_test_video",  target_id="{mock_test_id}:{student_id}"
실제 URL 패치는 upload.py::_patch_target_file 에서 처리.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.models.mock_test import MockTest, MockTestEntry, MockTestVideo
from app.models.notice import Notice
from app.models.class_info import class_students
from app.utils.auth import get_current_user
from app.services.notification_service import notify_users, emit_data_changed

router = APIRouter()


def _require_director(user: User) -> None:
    if user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장 전용")


def _names(db: Session, ids: List[str]) -> dict:
    if not ids:
        return {}
    rows = db.query(User.id, User.name).filter(User.id.in_(ids)).all()
    return {r[0]: r[1] for r in rows}


def _serialize(mt: MockTest, names: dict, with_detail: bool = False) -> dict:
    d = {
        "id": mt.id,
        "title": mt.title,
        "test_date": mt.test_date.isoformat() if mt.test_date else None,
        "description": mt.description,
        "status": mt.status,
        "created_at": mt.created_at.isoformat() if mt.created_at else None,
        "entry_count": len(mt.entries),
        "submitted_count": sum(1 for e in mt.entries if e.status == "submitted"),
    }
    if with_detail:
        d["entries"] = [
            {
                "id": e.id,
                "student_id": e.student_id,
                "student_name": names.get(e.student_id, "학생"),
                "sort_order": e.sort_order,
                "audio_url": e.audio_url,
                "status": e.status,
                "audio_submitted_at": e.audio_submitted_at.isoformat() if e.audio_submitted_at else None,
            }
            for e in mt.entries
        ]
        d["videos"] = [
            {
                "id": v.id, "student_id": v.student_id,
                "student_name": names.get(v.student_id, "학생"),
                "video_url": v.video_url, "thumbnail_url": v.thumbnail_url,
            }
            for v in mt.videos
        ]
    return d


# ── 원장 ─────────────────────────────────────────────────────────────

class CreateMockTest(BaseModel):
    title: str
    test_date: Optional[str] = None       # YYYY-MM-DD
    description: Optional[str] = None
    student_ids: List[str] = []           # 순서대로(= 순번)


@router.post("")
async def create_mock_test(data: CreateMockTest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    td = None
    if data.test_date:
        try:
            td = datetime.strptime(data.test_date.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 예: 2026-10-11")

    mt = MockTest(
        id=f"mt{uuid.uuid4().hex[:12]}",
        title=data.title.strip(),
        test_date=td,
        description=(data.description or None),
        created_by=current_user.id,
    )
    db.add(mt)
    # 선택 학생을 순번대로 엔트리 생성(중복 제거, 순서 유지)
    seen = set()
    idx = 0
    for sid in data.student_ids:
        if sid in seen:
            continue
        seen.add(sid)
        db.add(MockTestEntry(id=f"mte{uuid.uuid4().hex[:10]}", mock_test_id=mt.id, student_id=sid, sort_order=idx))
        idx += 1
    db.commit()
    db.refresh(mt)
    return _serialize(mt, _names(db, list(seen)), with_detail=True)


@router.get("")
def list_mock_tests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """원장: 전체 모의테스트 목록(최신순)."""
    _require_director(current_user)
    tests = db.query(MockTest).order_by(MockTest.created_at.desc()).all()
    return [_serialize(mt, {}) for mt in tests]


@router.get("/{mock_test_id}")
def mock_test_detail(mock_test_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """원장: 상세 — 학생 순번·음원 제출현황·업로드된 영상."""
    _require_director(current_user)
    mt = db.query(MockTest).filter(MockTest.id == mock_test_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="모의테스트를 찾을 수 없어요")
    ids = [e.student_id for e in mt.entries] + [v.student_id for v in mt.videos]
    return _serialize(mt, _names(db, ids), with_detail=True)


class ReorderReq(BaseModel):
    student_ids: List[str]   # 새 순서


@router.patch("/{mock_test_id}/order")
def reorder(mock_test_id: str, data: ReorderReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """원장: 학생 순번 재정렬."""
    _require_director(current_user)
    entries = db.query(MockTestEntry).filter(MockTestEntry.mock_test_id == mock_test_id).all()
    by_sid = {e.student_id: e for e in entries}
    order = 0
    for sid in data.student_ids:
        if sid in by_sid:
            by_sid[sid].sort_order = order
            order += 1
    db.commit()
    return {"ok": True}


@router.post("/{mock_test_id}/announce")
async def announce(mock_test_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """원장: 모의테스트를 공지로 발송 — 대상 학생 알림 + 공지 피드에 기록."""
    _require_director(current_user)
    mt = db.query(MockTest).filter(MockTest.id == mock_test_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="모의테스트를 찾을 수 없어요")
    student_ids = [e.student_id for e in mt.entries]
    if not student_ids:
        raise HTTPException(status_code=400, detail="참여 학생이 없어요")

    # 참여 학생들이 속한 반을 대상으로 공지 생성(공지 피드 노출)
    class_rows = db.query(class_students.c.class_id).filter(
        class_students.c.student_id.in_(student_ids)
    ).distinct().all()
    target_class_ids = [r[0] for r in class_rows] or None

    when = f" ({mt.test_date.isoformat()})" if mt.test_date else ""
    notice = Notice(
        id=f"notice{uuid.uuid4().hex[:7]}",
        title=f"[모의테스트] {mt.title}{when}",
        content=(mt.description or "모의테스트 안내입니다. 앱에서 순번을 확인하고 음원을 업로드해주세요."),
        author=current_user.name,
        important=True,
        class_id=None,
        target_class_ids=target_class_ids,
    )
    db.add(notice)
    db.commit()

    await notify_users(db, student_ids, f"모의테스트 공지: {mt.title}", entity="mock_tests")
    await emit_data_changed(student_ids, "notices")
    return {"ok": True, "notified": len(student_ids)}


@router.delete("/{mock_test_id}")
def delete_mock_test(mock_test_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_director(current_user)
    mt = db.query(MockTest).filter(MockTest.id == mock_test_id).first()
    if not mt:
        raise HTTPException(status_code=404, detail="모의테스트를 찾을 수 없어요")
    db.delete(mt)   # cascade로 엔트리·영상 함께 삭제
    db.commit()
    return {"ok": True}


# ── 학생 ─────────────────────────────────────────────────────────────

@router.get("/student/mine")
def my_mock_tests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """학생: 내가 참여하는 모의테스트 + 내 음원 제출 상태."""
    entries = db.query(MockTestEntry).filter(MockTestEntry.student_id == current_user.id).all()
    by_mt = {e.mock_test_id: e for e in entries}
    if not by_mt:
        return []
    tests = db.query(MockTest).filter(MockTest.id.in_(list(by_mt.keys()))).order_by(MockTest.created_at.desc()).all()
    out = []
    for mt in tests:
        e = by_mt[mt.id]
        vids = db.query(MockTestVideo).filter(
            MockTestVideo.mock_test_id == mt.id, MockTestVideo.student_id == current_user.id
        ).count()
        out.append({
            "id": mt.id, "title": mt.title,
            "test_date": mt.test_date.isoformat() if mt.test_date else None,
            "description": mt.description, "status": mt.status,
            "my_order": e.sort_order,
            "my_audio_url": e.audio_url,
            "my_status": e.status,
            "my_video_count": vids,
        })
    return out


@router.get("/{mock_test_id}/my-videos")
def my_videos(mock_test_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """학생: 이 모의테스트에서 원장이 나에게 배포한 영상들(본인 것만)."""
    # 본인이 참여자인지 확인
    entry = db.query(MockTestEntry).filter(
        MockTestEntry.mock_test_id == mock_test_id, MockTestEntry.student_id == current_user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=403, detail="참여하지 않은 모의테스트예요")
    vids = db.query(MockTestVideo).filter(
        MockTestVideo.mock_test_id == mock_test_id, MockTestVideo.student_id == current_user.id
    ).order_by(MockTestVideo.sort_order).all()
    return [{"id": v.id, "video_url": v.video_url, "thumbnail_url": v.thumbnail_url} for v in vids]
