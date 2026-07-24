from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks, Request, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.utils.auth import get_current_user
from app.database import get_db
from app.services.file_upload import (
    save_file, is_video, is_image, compress_video_sync, compress_image_sync,
    extract_thumbnail, UPLOAD_DIR, get_max_size, validate_file_ext, safe_segment,
)
from app.services.notification_service import emit_data_changed, get_teacher_ids_for_student, notify_users
from pathlib import Path
from pydantic import BaseModel
import asyncio
import uuid
import aiofiles
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory registry of active chunked uploads {upload_id: metadata}
_chunked_uploads: dict[str, dict] = {}
# 공유 dict의 read-modify-write(청크 누적·pop)를 직렬화 — 병렬 청크/동시 완료 레이스 방지.
# I/O는 절대 락 안에서 하지 않는다(글로벌 락이라 다른 세션까지 막힘): dict 접근만 짧게 보호.
_uploads_lock = asyncio.Lock()

# TTL for abandoned upload sessions (2 hours — enough for resume after phone sleep)
_UPLOAD_SESSION_TTL = 2 * 60 * 60


def _cleanup_expired_uploads():
    """Remove upload sessions older than TTL and delete their partial files.
    (동기 함수 — 이벤트 루프 밖 threadpool에서 호출. dict를 순회 중 다른 스레드가 수정해도
    안전하도록 items를 먼저 스냅샷. TTL(2h) 지난 세션만 만지므로 활성 업로드와 무관.)"""
    import time
    now = time.time()
    expired = [uid for uid, meta in list(_chunked_uploads.items())
               if now - meta.get("created_at", 0) > _UPLOAD_SESSION_TTL]
    for uid in expired:
        meta = _chunked_uploads.pop(uid, None)
        if meta:
            partial = Path(meta["path"])
            partial.unlink(missing_ok=True)
            # Clean up chunks directory
            chunks_dir = meta.get("chunks_dir")
            if chunks_dir:
                import shutil
                shutil.rmtree(chunks_dir, ignore_errors=True)
            logger.info(f"Cleaned up expired upload session: {uid}")


@router.post("/upload")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subfolder: str = Query("assignments"),
    target_type: Optional[str] = Query(None),  # "portfolio" or "assignment"
    target_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Pre-validate Content-Length before reading the full body.
    # Add 1MB headroom for multipart boundary overhead to avoid false rejections.
    content_length = request.headers.get("content-length")
    if content_length and file.filename:
        try:
            declared_size = int(content_length)
            max_size = get_max_size(file.filename)
            headroom = 1 * 1024 * 1024  # 1MB for multipart overhead
            if declared_size > max_size + headroom:
                max_mb = max_size // (1024 * 1024)
                raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {max_mb}MB")
        except ValueError:
            pass  # Non-numeric Content-Length, let streaming validation handle it

    url, filename = await save_file(file, subfolder=subfolder, user_id=current_user.id)

    # 영상 썸네일은 ffmpeg 서브프로세스라 이벤트 루프를 막으므로 threadpool에서 1회만 추출해 재사용.
    video = is_video(filename)
    thumbnail_url = None
    file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
    if video:
        thumbnail_url = await run_in_threadpool(extract_thumbnail, file_path)

    # Server-side DB patch: ensures file URL is saved even if client disconnects.
    # 동기 DB + (없어진)ffmpeg를 이벤트 루프에서 직접 돌리지 않도록 threadpool로 오프로드.
    patched_owner: Optional[str] = None
    if target_type and target_id:
        patched_owner = await run_in_threadpool(
            _patch_target_file, db, target_type, target_id, url, current_user.id, thumbnail_url
        )
        if patched_owner is None:
            # DB patch failed (target gone / not owned) — clean up orphan + signal failure
            # so the native background uploader shows '실패' instead of a false '완료'.
            (UPLOAD_DIR / url.removeprefix("/uploads/")).unlink(missing_ok=True)
            logger.warning(f"Cleaned up orphaned upload: {url}")
            raise HTTPException(status_code=409, detail="업로드 대상을 찾을 수 없어요(삭제되었거나 권한이 없어요).")

    # Start background video/image compression
    if video:
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)
    elif is_image(filename):
        background_tasks.add_task(compress_image_sync, file_path)

    # Live-refresh owner + teachers once the (possibly background) upload landed
    if patched_owner is not None and target_type:
        await _emit_target_patched(db, target_type, patched_owner)

    return {"url": url, "filename": filename, "is_video": video, "thumbnail_url": thumbnail_url}


# ── Chunked upload endpoints ──
# Flow: POST /upload/chunked/init → POST /upload/chunked/{id} (repeat) → POST /upload/chunked/{id}/complete


class ChunkedInitRequest(BaseModel):
    filename: str
    total_size: int
    subfolder: str = "assignments"
    target_type: Optional[str] = None
    target_id: Optional[str] = None


@router.post("/upload/chunked/init")
async def chunked_init(
    data: ChunkedInitRequest,
    current_user: User = Depends(get_current_user),
):
    """Start a chunked upload session. Returns upload_id."""
    validate_file_ext(data.filename)

    max_size = get_max_size(data.filename)
    if data.total_size > max_size:
        max_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {max_mb}MB")

    import time
    # Clean up expired sessions before creating new ones (rmtree I/O는 threadpool에서 — 루프 미차단)
    await run_in_threadpool(_cleanup_expired_uploads)

    # 경로 우회 방지: 클라 입력(subfolder·filename)을 단일 안전 세그먼트로 정규화.
    subfolder = safe_segment(data.subfolder, "assignments")
    safe_name = safe_segment(data.filename, "file")
    upload_id = uuid.uuid4().hex[:16]
    unique_name = f"{uuid.uuid4().hex[:12]}_{safe_name}"
    target_dir = UPLOAD_DIR / subfolder / current_user.id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / unique_name

    # Create chunks directory for parallel uploads
    chunks_dir = target_dir / f".chunks_{upload_id}"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    _chunked_uploads[upload_id] = {
        "path": str(target_path),
        "chunks_dir": str(chunks_dir),
        "filename": data.filename,
        "total_size": data.total_size,
        "received": 0,
        "subfolder": subfolder,
        "user_id": current_user.id,
        "target_type": data.target_type,
        "target_id": data.target_id,
        "unique_name": unique_name,
        "created_at": time.time(),
    }
    logger.warning(f"Chunked upload init: {upload_id} by {current_user.name}({current_user.id}) ({data.filename}, {data.total_size // 1024}KB, target={data.target_type}/{data.target_id})")
    return {"upload_id": upload_id}


@router.post("/upload/chunked/{upload_id}")
async def chunked_upload(
    upload_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a single chunk. Saves as individual file for parallel support."""
    meta = _chunked_uploads.get(upload_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Upload session not found or expired")
    if meta["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your upload session")

    chunk_data = await file.read()
    chunk_size = len(chunk_data)

    # Extract chunk index from filename (chunk_0, chunk_1, ...)
    chunk_name = file.filename or "chunk_0"
    idx_str = chunk_name.replace("chunk_", "").split(".")[0]
    try:
        chunk_idx = int(idx_str)
    except ValueError:
        # 인덱스 파싱 실패 시 순번 채번 — 병렬 요청이 같은 번호를 받지 않도록 락으로 보호.
        async with _uploads_lock:
            chunk_idx = meta.get("_next_idx", 0)
            meta["_next_idx"] = chunk_idx + 1

    # Save as individual numbered file — overwrite-safe so resume re-sends are OK (I/O는 락 밖)
    chunks_dir = Path(meta["chunks_dir"])
    chunk_path = chunks_dir / f"{chunk_idx:06d}"
    async with aiofiles.open(chunk_path, "wb") as f:
        await f.write(chunk_data)

    # received 바이트는 '새' 청크 인덱스일 때만 누적 — 재전송/이어받기 중복 카운트 방지.
    # 병렬 청크의 read-modify-write 레이스를 막기 위해 dict 갱신만 짧게 락(디스크 I/O는 이미 끝남).
    async with _uploads_lock:
        received_idx = meta.setdefault("received_idx", set())
        if chunk_idx not in received_idx:
            received_idx.add(chunk_idx)
            meta["received"] += chunk_size
        received_total = meta["received"]
    pct = min(100, received_total * 100 // max(meta["total_size"], 1))
    return {"received": received_total, "progress": pct, "chunk_idx": chunk_idx}


@router.get("/upload/chunked/{upload_id}/status")
async def chunked_status(upload_id: str, current_user: User = Depends(get_current_user)):
    """이어받기(resume)용 — 이미 받은 청크를 기준으로 다음에 보낼 인덱스를 알려준다.
    클라이언트는 같은 upload_id로 재시도 시 next_chunk부터 이어 보낸다.
    세션이 없으면(만료/재시작) 404 → 클라이언트는 처음부터 새 init."""
    meta = _chunked_uploads.get(upload_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Upload session not found or expired")
    if meta["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your upload session")
    chunks_dir = Path(meta["chunks_dir"])
    received = sorted(int(p.name) for p in chunks_dir.iterdir() if p.name.isdigit()) if chunks_dir.exists() else []
    rec = set(received)
    next_idx = 0
    while next_idx in rec:
        next_idx += 1
    return {"received_count": len(received), "next_chunk": next_idx, "total_size": meta.get("total_size", 0)}


@router.post("/upload/chunked/{upload_id}/complete")
async def chunked_complete(
    upload_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finalize chunked upload: validate, patch DB, start compression."""
    # 소유 확인 후 원자적으로 제거 — 동시 complete 이중처리(TOCTOU) 방지.
    async with _uploads_lock:
        meta = _chunked_uploads.get(upload_id)
        if meta is None:
            raise HTTPException(status_code=404, detail="Upload session not found or expired")
        if meta["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Not your upload session")
        _chunked_uploads.pop(upload_id, None)

    import shutil
    target_path = Path(meta["path"])
    chunks_dir = Path(meta["chunks_dir"])

    async def _cleanup_partial():
        # 실패 시 부분 파일·청크 디렉토리 정리(고아 방지). I/O는 threadpool.
        await run_in_threadpool(lambda: target_path.unlink(missing_ok=True))
        await run_in_threadpool(shutil.rmtree, str(chunks_dir), True)

    try:
        # Assemble chunks in order
        chunk_files = sorted(
            [f for f in chunks_dir.iterdir() if not f.name.startswith('.')],
            key=lambda p: int(p.name)
        )
        if not chunk_files:
            raise HTTPException(status_code=400, detail="No chunks found")

        # 스트리밍 조립(1MB 단위) — 청크 전체를 RAM에 올리지 않음(동시 업로드 시 메모리 폭주 방지).
        async with aiofiles.open(target_path, "wb") as out:
            for cf in chunk_files:
                async with aiofiles.open(cf, "rb") as inp:
                    while True:
                        buf = await inp.read(1024 * 1024)
                        if not buf:
                            break
                        await out.write(buf)

        # Clean up chunk files (rmtree I/O는 threadpool)
        await run_in_threadpool(shutil.rmtree, str(chunks_dir), True)

        actual_size = target_path.stat().st_size
        if actual_size == 0:
            raise HTTPException(status_code=400, detail="업로드된 파일이 비어있습니다.")
        # Allow 1% tolerance for size mismatch
        if abs(actual_size - meta["total_size"]) > meta["total_size"] * 0.01 + 1024:
            raise HTTPException(
                status_code=400,
                detail=f"파일 크기 불일치 (예상: {meta['total_size']}, 실제: {actual_size}). 다시 업로드해주세요.",
            )

        url_path = f"{meta['subfolder']}/{meta['user_id']}/{meta['unique_name']}"
        url = f"/uploads/{url_path}"
        filename = meta["filename"]

        # 썸네일은 ffmpeg라 threadpool에서 1회만 추출해 재사용(이벤트 루프 미차단).
        video = is_video(filename)
        thumbnail_url = None
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        if video:
            thumbnail_url = await run_in_threadpool(extract_thumbnail, file_path)

        # DB patch (동기 DB → threadpool, 이벤트 루프 미차단)
        patched_owner: Optional[str] = None
        if meta.get("target_type") and meta.get("target_id"):
            patched_owner = await run_in_threadpool(
                _patch_target_file, db, meta["target_type"], meta["target_id"], url, current_user.id, thumbnail_url
            )
            if patched_owner is None:
                raise HTTPException(status_code=409, detail="업로드 대상을 찾을 수 없어요(삭제되었거나 권한이 없어요).")

        # Background video/image compression
        if video:
            background_tasks.add_task(compress_video_sync, file_path, current_user.id)
        elif is_image(filename):
            background_tasks.add_task(compress_image_sync, file_path)
    except HTTPException:
        await _cleanup_partial()
        raise
    except Exception as e:
        await _cleanup_partial()
        logger.exception(f"Chunked complete failed ({upload_id}): {e}")
        raise HTTPException(status_code=500, detail="업로드 완료 처리에 실패했어요. 다시 시도해주세요.")

    # Live-refresh owner + teachers once the (possibly background) upload landed
    if patched_owner is not None and meta.get("target_type"):
        await _emit_target_patched(db, meta["target_type"], patched_owner)

    logger.warning(f"Chunked upload complete: {url} by {current_user.name}({current_user.id}) ({actual_size // 1024}KB)")
    return {"url": url, "filename": filename, "is_video": video, "thumbnail_url": thumbnail_url}


def _patch_target_file(
    db: Session, target_type: str, target_id: str, url: str, user_id: str,
    thumbnail_url: Optional[str] = None,
) -> Optional[str]:
    """Patch the file URL on the target record directly after upload.

    Enables the "create record first, upload in background" pattern: the URL is
    saved on the target even if the client app is closed/suspended (true
    background upload). Returns the owner student_id on success, None otherwise.

    썸네일은 호출측이 threadpool에서 미리 추출해 넘긴다(여기서 ffmpeg를 돌려 DB 커넥션을
    잡고 있지 않도록 — 커넥션 풀 고갈 방지). 이 함수 자체도 async 핸들러에서 run_in_threadpool로 호출됨.
    """
    try:
        if target_type == "portfolio":
            from app.models.portfolio import Portfolio
            p = db.query(Portfolio).filter(
                Portfolio.id == target_id,
                Portfolio.student_id == user_id,
            ).first()
            if p:
                p.video_url = url
                if thumbnail_url:
                    p.thumbnail_url = thumbnail_url
                db.commit()
                return p.student_id
        elif target_type == "portfolio_video":
            # 모드 A(한 포트폴리오에 여러 영상): 추가 영상을 PortfolioVideo 행으로 생성
            from app.models.portfolio import Portfolio, PortfolioVideo
            p = db.query(Portfolio).filter(
                Portfolio.id == target_id,
                Portfolio.student_id == user_id,
            ).first()
            if p:
                order = db.query(PortfolioVideo).filter(
                    PortfolioVideo.portfolio_id == target_id
                ).count()
                pv = PortfolioVideo(
                    id=f"pv{uuid.uuid4().hex[:8]}",
                    portfolio_id=target_id,
                    video_url=url,
                    thumbnail_url=thumbnail_url,
                    sort_order=order,
                )
                db.add(pv)
                db.commit()
                return p.student_id
        elif target_type == "assignment":
            from app.models.assignment import Assignment
            a = db.query(Assignment).filter(
                Assignment.id == target_id,
                Assignment.student_id == user_id,
            ).first()
            if a:
                a.submission_file_url = url
                db.commit()
                return a.student_id
        elif target_type == "mock_test_audio":
            # 학생이 본인 모의테스트 음원을 업로드 → 해당 엔트리에 URL 패치. target_id=mock_test_id
            from app.models.mock_test import MockTestEntry
            from datetime import datetime as _dt
            e = db.query(MockTestEntry).filter(
                MockTestEntry.mock_test_id == target_id,
                MockTestEntry.student_id == user_id,
            ).first()
            if e:
                e.audio_url = url
                e.status = "submitted"
                e.audio_submitted_at = _dt.utcnow()
                db.commit()
                return e.student_id
        elif target_type == "mock_test_video":
            # 원장이 학생별 시험영상 업로드 → MockTestVideo 행 생성. target_id="{mock_test_id}:{student_id}"
            from app.models.mock_test import MockTest, MockTestVideo
            from app.models.user import User as _User, UserRole as _Role
            uploader = db.query(_User).filter(_User.id == user_id).first()
            if not uploader or uploader.role != _Role.DIRECTOR:
                return None  # 원장만 영상 배포 가능
            try:
                mt_id, sid = target_id.split(":", 1)
            except ValueError:
                return None
            mt = db.query(MockTest).filter(MockTest.id == mt_id).first()
            if mt:
                order = db.query(MockTestVideo).filter(
                    MockTestVideo.mock_test_id == mt_id,
                    MockTestVideo.student_id == sid,
                ).count()
                v = MockTestVideo(
                    id=f"mtv{uuid.uuid4().hex[:8]}",
                    mock_test_id=mt_id, student_id=sid,
                    video_url=url, thumbnail_url=thumbnail_url, sort_order=order,
                )
                db.add(v)
                db.commit()
                return sid  # 배포 대상 학생(알림 대상)
        return None
    except Exception as e:
        logger.warning(f"_patch_target_file failed ({target_type}/{target_id}): {e}")
        db.rollback()
        return None


async def _emit_target_patched(db: Session, target_type: str, owner_id: str) -> None:
    """Notify owner + their teachers so the freshly-uploaded file appears live,
    even when the upload finished while the app was in the background.
    For a portfolio cover video, also push the teacher notification HERE (when the
    video actually landed) instead of at empty-record creation time."""
    try:
        from app.models.user import User, UserRole
        # 모의테스트: 음원 제출 → 원장 알림 / 영상 배포 → 대상 학생 알림
        if target_type in ("mock_test_audio", "mock_test_video"):
            student = db.query(User).filter(User.id == owner_id).first()
            name = student.name if student else "학생"
            if target_type == "mock_test_audio":
                director_ids = [r[0] for r in db.query(User.id).filter(User.role == UserRole.DIRECTOR).all()]
                await emit_data_changed([owner_id, *director_ids], "mock_tests")
                if director_ids:
                    await notify_users(db, director_ids, f"{name}님이 모의테스트 음원을 제출했어요", entity="mock_tests")
            else:  # mock_test_video
                await emit_data_changed([owner_id], "mock_tests")
                await notify_users(db, [owner_id], "모의테스트 영상이 도착했어요", entity="mock_tests")
            return

        entity = "assignments" if target_type == "assignment" else "portfolios"
        teacher_ids = get_teacher_ids_for_student(db, owner_id)
        await emit_data_changed([owner_id, *teacher_ids], entity)
        # 새 영상 커버가 실제로 도착한 시점에 교사 알림(추가 영상 portfolio_video는 알림 생략)
        if target_type == "portfolio" and teacher_ids:
            student = db.query(User).filter(User.id == owner_id).first()
            name = student.name if student else "학생"
            await notify_users(db, teacher_ids, f"{name}님이 새 영상을 올렸어요", entity="portfolios")
    except Exception as e:
        logger.warning(f"_emit_target_patched failed ({target_type}/{owner_id}): {e}")
