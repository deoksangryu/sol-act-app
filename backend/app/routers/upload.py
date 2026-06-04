from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks, Request, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.utils.auth import get_current_user
from app.database import get_db
from app.services.file_upload import (
    save_file, is_video, is_image, compress_video_sync, compress_image_sync,
    extract_thumbnail, UPLOAD_DIR, get_max_size, validate_file_ext,
)
from app.services.notification_service import emit_data_changed, get_teacher_ids_for_student, notify_users
from pathlib import Path
from pydantic import BaseModel
import uuid
import aiofiles
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory registry of active chunked uploads {upload_id: metadata}
_chunked_uploads: dict[str, dict] = {}

# TTL for abandoned upload sessions (2 hours — enough for resume after phone sleep)
_UPLOAD_SESSION_TTL = 2 * 60 * 60


def _cleanup_expired_uploads():
    """Remove upload sessions older than TTL and delete their partial files."""
    import time
    now = time.time()
    expired = [uid for uid, meta in _chunked_uploads.items()
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

    # Server-side DB patch: ensures file URL is saved even if client disconnects
    patched_owner: Optional[str] = None
    if target_type and target_id:
        patched_owner = _patch_target_file(db, target_type, target_id, url, current_user.id)
        if patched_owner is None:
            # DB patch failed (target gone / not owned) — clean up orphan + signal failure
            # so the native background uploader shows '실패' instead of a false '완료'.
            file_path = UPLOAD_DIR / url.removeprefix("/uploads/")
            file_path.unlink(missing_ok=True)
            logger.warning(f"Cleaned up orphaned upload: {url}")
            raise HTTPException(status_code=409, detail="업로드 대상을 찾을 수 없어요(삭제되었거나 권한이 없어요).")

    # Start background video compression for video files
    video = is_video(filename)
    thumbnail_url = None
    if video:
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        # Extract thumbnail before compression (synchronous, fast ~1s)
        thumbnail_url = extract_thumbnail(file_path)
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)
    elif is_image(filename):
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
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
    # Clean up expired sessions before creating new ones
    _cleanup_expired_uploads()

    upload_id = uuid.uuid4().hex[:16]
    unique_name = f"{uuid.uuid4().hex[:12]}_{data.filename}"
    target_dir = UPLOAD_DIR / data.subfolder / current_user.id
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
        "subfolder": data.subfolder,
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

    if meta["received"] + chunk_size > meta["total_size"] + 1024:
        raise HTTPException(status_code=400, detail="Received more data than declared total_size")

    # Extract chunk index from filename (chunk_0, chunk_1, ...)
    chunk_name = file.filename or "chunk_0"
    chunk_idx = chunk_name.replace("chunk_", "").split(".")[0]
    try:
        chunk_idx = int(chunk_idx)
    except ValueError:
        chunk_idx = meta.get("_next_idx", 0)
        meta["_next_idx"] = chunk_idx + 1

    # Save as individual numbered file
    chunks_dir = Path(meta["chunks_dir"])
    chunk_path = chunks_dir / f"{chunk_idx:06d}"
    async with aiofiles.open(chunk_path, "wb") as f:
        await f.write(chunk_data)

    meta["received"] += chunk_size
    pct = min(100, meta["received"] * 100 // max(meta["total_size"], 1))
    return {"received": meta["received"], "progress": pct}


@router.post("/upload/chunked/{upload_id}/complete")
async def chunked_complete(
    upload_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finalize chunked upload: validate, patch DB, start compression."""
    meta = _chunked_uploads.pop(upload_id, None)
    if not meta:
        raise HTTPException(status_code=404, detail="Upload session not found or expired")
    if meta["user_id"] != current_user.id:
        _chunked_uploads[upload_id] = meta  # put back
        raise HTTPException(status_code=403, detail="Not your upload session")

    # Assemble chunks in order
    target_path = Path(meta["path"])
    chunks_dir = Path(meta["chunks_dir"])
    chunk_files = sorted(
        [f for f in chunks_dir.iterdir() if not f.name.startswith('.')],
        key=lambda p: int(p.name)
    )

    if not chunk_files:
        chunks_dir.rmdir()
        raise HTTPException(status_code=400, detail="No chunks found")

    async with aiofiles.open(target_path, "wb") as out:
        for cf in chunk_files:
            async with aiofiles.open(cf, "rb") as inp:
                await out.write(await inp.read())

    # Clean up chunk files
    import shutil
    shutil.rmtree(str(chunks_dir), ignore_errors=True)

    actual_size = target_path.stat().st_size
    if actual_size == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="업로드된 파일이 비어있습니다.")

    # Allow 1% tolerance for size mismatch
    if abs(actual_size - meta["total_size"]) > meta["total_size"] * 0.01 + 1024:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기 불일치 (예상: {meta['total_size']}, 실제: {actual_size}). 다시 업로드해주세요.",
        )

    url_path = f"{meta['subfolder']}/{meta['user_id']}/{meta['unique_name']}"
    url = f"/uploads/{url_path}"
    filename = meta["filename"]

    # DB patch
    patched_owner: Optional[str] = None
    if meta.get("target_type") and meta.get("target_id"):
        patched_owner = _patch_target_file(db, meta["target_type"], meta["target_id"], url, current_user.id)
        if patched_owner is None:
            target_path.unlink(missing_ok=True)
            logger.warning(f"Cleaned up orphaned chunked upload: {url}")
            raise HTTPException(status_code=409, detail="업로드 대상을 찾을 수 없어요(삭제되었거나 권한이 없어요).")

    # Video compression / Image compression
    video = is_video(filename)
    thumbnail_url = None
    if video:
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        thumbnail_url = extract_thumbnail(file_path)
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)
    elif is_image(filename):
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        background_tasks.add_task(compress_image_sync, file_path)

    # Live-refresh owner + teachers once the (possibly background) upload landed
    if patched_owner is not None and meta.get("target_type"):
        await _emit_target_patched(db, meta["target_type"], patched_owner)

    logger.warning(f"Chunked upload complete: {url} by {current_user.name}({current_user.id}) ({actual_size // 1024}KB)")
    return {"url": url, "filename": filename, "is_video": video, "thumbnail_url": thumbnail_url}


def _patch_target_file(
    db: Session, target_type: str, target_id: str, url: str, user_id: str
) -> Optional[str]:
    """Patch the file URL on the target record directly after upload.

    Enables the "create record first, upload in background" pattern: the URL is
    saved on the target even if the client app is closed/suspended (true
    background upload). Returns the owner student_id on success, None otherwise.
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
                thumb = None
                if url.startswith("/uploads/"):
                    try:
                        thumb = extract_thumbnail(str(UPLOAD_DIR / url.removeprefix("/uploads/")))
                    except Exception:
                        thumb = None
                pv = PortfolioVideo(
                    id=f"pv{uuid.uuid4().hex[:8]}",
                    portfolio_id=target_id,
                    video_url=url,
                    thumbnail_url=thumb,
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
        entity = "assignments" if target_type == "assignment" else "portfolios"
        teacher_ids = get_teacher_ids_for_student(db, owner_id)
        await emit_data_changed([owner_id, *teacher_ids], entity)
        # 새 영상 커버가 실제로 도착한 시점에 교사 알림(추가 영상 portfolio_video는 알림 생략)
        if target_type == "portfolio" and teacher_ids:
            from app.models.user import User
            student = db.query(User).filter(User.id == owner_id).first()
            name = student.name if student else "학생"
            await notify_users(db, teacher_ids, f"{name}님이 새 영상을 올렸어요", entity="portfolios")
    except Exception as e:
        logger.warning(f"_emit_target_patched failed ({target_type}/{owner_id}): {e}")
