from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks, Request, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.utils.auth import get_current_user
from app.database import get_db
from app.services.file_upload import (
    save_file, is_video, compress_video_sync, extract_thumbnail,
    UPLOAD_DIR, get_max_size, validate_file_ext,
)
from pathlib import Path
from pydantic import BaseModel
import uuid
import aiofiles
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory registry of active chunked uploads {upload_id: metadata}
_chunked_uploads: dict[str, dict] = {}


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
    if target_type and target_id:
        if not _patch_target_file(db, target_type, target_id, url, current_user.id):
            # DB patch failed — clean up orphaned file
            file_path = UPLOAD_DIR / url.removeprefix("/uploads/")
            file_path.unlink(missing_ok=True)
            logger.warning(f"Cleaned up orphaned upload: {url}")

    # Start background video compression for video files
    video = is_video(filename)
    thumbnail_url = None
    if video:
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        # Extract thumbnail before compression (synchronous, fast ~1s)
        thumbnail_url = extract_thumbnail(file_path)
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)

    return {"url": url, "filename": filename, "is_video": video, "thumbnail_url": thumbnail_url}


# ── Chunked upload endpoints ──
# Flow: POST /upload/chunked/init → POST /upload/chunked/{id} (repeat) → POST /upload/chunked/{id}/complete


class ChunkedInitRequest(BaseModel):
    filename: str
    total_size: int
    subfolder: str = "assignments"
    target_type: Optional[str] = None
    target_id: Optional[str] = None


@router.post("/upload/chunked/init/")
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

    upload_id = uuid.uuid4().hex[:16]
    unique_name = f"{uuid.uuid4().hex[:12]}_{data.filename}"
    target_dir = UPLOAD_DIR / data.subfolder / current_user.id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / unique_name

    _chunked_uploads[upload_id] = {
        "path": str(target_path),
        "filename": data.filename,
        "total_size": data.total_size,
        "received": 0,
        "subfolder": data.subfolder,
        "user_id": current_user.id,
        "target_type": data.target_type,
        "target_id": data.target_id,
        "unique_name": unique_name,
    }
    logger.info(f"Chunked upload init: {upload_id} ({data.filename}, {data.total_size // 1024}KB)")
    return {"upload_id": upload_id}


@router.post("/upload/chunked/{upload_id}/")
async def chunked_upload(
    upload_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a single chunk. Append to the file on disk."""
    meta = _chunked_uploads.get(upload_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Upload session not found or expired")
    if meta["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not your upload session")

    target_path = Path(meta["path"])
    chunk_data = await file.read()
    chunk_size = len(chunk_data)

    if meta["received"] + chunk_size > meta["total_size"] + 1024:
        raise HTTPException(status_code=400, detail="Received more data than declared total_size")

    async with aiofiles.open(target_path, "ab") as f:
        await f.write(chunk_data)

    meta["received"] += chunk_size
    pct = min(100, meta["received"] * 100 // max(meta["total_size"], 1))
    return {"received": meta["received"], "progress": pct}


@router.post("/upload/chunked/{upload_id}/complete/")
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

    target_path = Path(meta["path"])
    if not target_path.exists():
        raise HTTPException(status_code=400, detail="Upload file not found on server")

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
    if meta.get("target_type") and meta.get("target_id"):
        if not _patch_target_file(db, meta["target_type"], meta["target_id"], url, current_user.id):
            target_path.unlink(missing_ok=True)
            logger.warning(f"Cleaned up orphaned chunked upload: {url}")

    # Video compression
    video = is_video(filename)
    thumbnail_url = None
    if video:
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        thumbnail_url = extract_thumbnail(file_path)
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)

    logger.info(f"Chunked upload complete: {url} ({actual_size // 1024}KB)")
    return {"url": url, "filename": filename, "is_video": video, "thumbnail_url": thumbnail_url}


def _patch_target_file(
    db: Session, target_type: str, target_id: str, url: str, user_id: str
) -> bool:
    """Patch the file URL on the target record directly after upload.

    Returns True if the record was found and patched, False otherwise.
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
                return True
        elif target_type == "assignment":
            from app.models.assignment import Assignment
            a = db.query(Assignment).filter(
                Assignment.id == target_id,
                Assignment.student_id == user_id,
            ).first()
            if a:
                a.submission_file_url = url
                db.commit()
                return True
        return False
    except Exception as e:
        logger.warning(f"_patch_target_file failed ({target_type}/{target_id}): {e}")
        db.rollback()
        return False
