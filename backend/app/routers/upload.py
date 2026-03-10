from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks, Request, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.utils.auth import get_current_user
from app.database import get_db
from app.services.file_upload import save_file, is_video, compress_video_sync, UPLOAD_DIR, get_max_size
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


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
    # Pre-validate Content-Length before reading the full body
    content_length = request.headers.get("content-length")
    if content_length and file.filename:
        try:
            declared_size = int(content_length)
            max_size = get_max_size(file.filename)
            if declared_size > max_size:
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
    if video:
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)

    return {"url": url, "filename": filename, "is_video": video}


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
