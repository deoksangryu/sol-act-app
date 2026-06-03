from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.music import Track, MusicDownloadRequest, RequestStatus
from app.models.user import User, UserRole
from app.schemas.music import (
    TrackCreate, TrackResponse,
    RequestCreate, RequestRespond, RequestResponse,
)
from app.utils.auth import get_current_user
from app.services.notification_service import (
    notify_user, notify_users, emit_data_changed,
    get_teacher_ids_for_student, get_teacher_student_ids,
)
import uuid

router = APIRouter()


def _my_request_info(req: MusicDownloadRequest) -> dict:
    return {
        "id": req.id,
        "status": req.status,
        "purpose": req.purpose,
        "response_note": req.response_note,
        "created_at": req.created_at,
        "responded_at": req.responded_at,
    }


def track_to_response(t: Track, current_user: User) -> dict:
    """트랙 → 응답. 학생이면 본인 요청 상태, 선생님/원장이면 승인 대기 수 포함."""
    my_request = None
    pending_count = 0
    if current_user.role == UserRole.STUDENT:
        mine = next(
            (r for r in sorted(t.requests, key=lambda r: r.created_at, reverse=True)
             if r.student_id == current_user.id),
            None,
        )
        if mine:
            my_request = _my_request_info(mine)
    elif current_user.role == UserRole.DIRECTOR:
        pending_count = sum(1 for r in t.requests if r.status == RequestStatus.PENDING)
    return {
        "id": t.id,
        "title": t.title,
        "category": t.category,
        "mood": t.mood,
        "duration": t.duration,
        "file_url": t.file_url,
        "thumbnail_url": t.thumbnail_url,
        "created_at": t.created_at,
        "my_request": my_request,
        "pending_count": pending_count,
    }


def request_to_response(r: MusicDownloadRequest) -> dict:
    return {
        "id": r.id,
        "track_id": r.track_id,
        "track_title": r.track.title if r.track else "",
        "student_id": r.student_id,
        "student_name": r.student.name if r.student else "",
        "purpose": r.purpose,
        "status": r.status,
        "response_note": r.response_note,
        "created_at": r.created_at,
        "responded_at": r.responded_at,
    }


# ── Tracks ──

@router.get("/tracks", response_model=List[TrackResponse])
def list_tracks(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """무용 음악 목록. 인앱 청취는 전원 가능하므로 역할 무관 전체 조회."""
    query = db.query(Track).options(joinedload(Track.requests))
    if category and category != "all":
        query = query.filter(Track.category == category)
    tracks = query.order_by(Track.created_at.desc()).all()
    return [track_to_response(t, current_user) for t in tracks]


@router.get("/tracks/{track_id}", response_model=TrackResponse)
def get_track(track_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(Track).options(joinedload(Track.requests)).filter(Track.id == track_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
    return track_to_response(t, current_user)


@router.post("/tracks", response_model=TrackResponse, status_code=status.HTTP_201_CREATED)
def create_track(
    data: TrackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """음원 등록 (선생님/원장만)."""
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    track = Track(
        id=f"trk{uuid.uuid4().hex[:7]}",
        title=data.title,
        category=data.category,
        mood=data.mood,
        duration=data.duration,
        file_url=data.file_url,
        thumbnail_url=data.thumbnail_url,
        created_by=current_user.id,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track_to_response(track, current_user)


@router.delete("/tracks/{track_id}")
def delete_track(track_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.TEACHER, UserRole.DIRECTOR]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    t = db.query(Track).filter(Track.id == track_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
    db.delete(t)
    db.commit()
    return {"message": "Track deleted"}


@router.get("/tracks/{track_id}/download")
def download_track(track_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """다운로드 권한 확인. 승인된 학생 또는 선생님/원장만 파일 URL 반환."""
    t = db.query(Track).filter(Track.id == track_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
    if not t.file_url:
        raise HTTPException(status_code=404, detail="음원 파일이 아직 등록되지 않았어요")

    if current_user.role == UserRole.STUDENT:
        approved = db.query(MusicDownloadRequest).filter(
            MusicDownloadRequest.track_id == track_id,
            MusicDownloadRequest.student_id == current_user.id,
            MusicDownloadRequest.status == RequestStatus.APPROVED,
        ).first()
        if not approved:
            raise HTTPException(status_code=403, detail="다운로드 권한이 없어요. 먼저 요청해 주세요")
    elif current_user.role == UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="음원 전달은 원장이 처리해요")

    filename = t.file_url.rsplit("/", 1)[-1]
    return {"url": t.file_url, "filename": filename}


# ── Download Requests ──

@router.get("/requests", response_model=List[RequestResponse])
def list_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """학생: 본인 요청 / 원장: 전체 요청. (음원은 원장이 직접 전달하므로 원장만 확인·처리)"""
    if current_user.role not in (UserRole.STUDENT, UserRole.DIRECTOR):
        return []  # 선생님 등 다른 역할은 음원 요청을 보지 않음

    query = db.query(MusicDownloadRequest).options(
        joinedload(MusicDownloadRequest.track),
        joinedload(MusicDownloadRequest.student),
    )
    if current_user.role == UserRole.STUDENT:
        query = query.filter(MusicDownloadRequest.student_id == current_user.id)
    # DIRECTOR: 전체 요청

    if status_filter:
        try:
            st = RequestStatus(status_filter)
            query = query.filter(MusicDownloadRequest.status == st)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_filter}")

    requests = query.order_by(MusicDownloadRequest.created_at.desc()).all()
    return [request_to_response(r) for r in requests]


@router.post("/requests", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """학생이 다운로드 권한 요청 → 담당 선생님에게 알림."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="학생만 요청할 수 있어요")
    track = db.query(Track).filter(Track.id == data.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    req = MusicDownloadRequest(
        id=f"mreq{uuid.uuid4().hex[:7]}",
        track_id=data.track_id,
        student_id=current_user.id,
        purpose=data.purpose,
        status=RequestStatus.PENDING,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # 음원은 원장이 직접 전달하므로 원장에게만 알림
    director_ids = [r[0] for r in db.query(User.id).filter(User.role == UserRole.DIRECTOR).all()]
    if director_ids:
        await notify_users(
            db, director_ids,
            f"{current_user.name}님이 음원 요청을 보냈어요",
            entity="music",
        )

    r = db.query(MusicDownloadRequest).options(
        joinedload(MusicDownloadRequest.track),
        joinedload(MusicDownloadRequest.student),
    ).filter(MusicDownloadRequest.id == req.id).first()
    return request_to_response(r)


@router.put("/requests/{request_id}", response_model=RequestResponse)
async def respond_request(
    request_id: str,
    data: RequestRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """원장이 요청을 승인 또는 거절 → 학생에게 알림."""
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 음원 요청을 처리할 수 있어요")
    if data.status not in [RequestStatus.APPROVED, RequestStatus.REJECTED]:
        raise HTTPException(status_code=400, detail="승인 또는 거절만 가능해요")

    r = db.query(MusicDownloadRequest).options(
        joinedload(MusicDownloadRequest.track),
        joinedload(MusicDownloadRequest.student),
    ).filter(MusicDownloadRequest.id == request_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")

    r.status = data.status
    r.response_note = data.response_note
    r.responded_at = datetime.utcnow()
    db.commit()
    db.refresh(r)

    msg = "음원 다운로드가 승인됐어요" if data.status == RequestStatus.APPROVED else "음원 요청이 검토됐어요"
    await notify_user(db, r.student_id, msg, entity="music")

    return request_to_response(r)
