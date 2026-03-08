from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from app.models.user import User
from app.utils.auth import get_current_user
from app.database import get_db
from app.services.file_upload import save_file, is_video, compress_video_sync, UPLOAD_DIR
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subfolder: str = Query("assignments"),
    target_type: Optional[str] = Query(None),  # "portfolio" or "assignment"
    target_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url, filename = await save_file(file, subfolder=subfolder, user_id=current_user.id)

    # Server-side DB patch: ensures file URL is saved even if client disconnects
    if target_type and target_id:
        _patch_target_file(db, target_type, target_id, url, current_user.id)

    # Start background video compression for video files
    video = is_video(filename)
    if video:
        file_path = str(UPLOAD_DIR / url.removeprefix("/uploads/"))
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)

    return {"url": url, "filename": filename, "is_video": video}


def _patch_target_file(
    db: Session, target_type: str, target_id: str, url: str, user_id: str
) -> None:
    """Patch the file URL on the target record directly after upload.

    This runs server-side so the file URL is persisted even if the client
    disconnects (e.g. logout) before the client-side patch request is sent.
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
        elif target_type == "assignment":
            from app.models.assignment import Assignment
            a = db.query(Assignment).filter(
                Assignment.id == target_id,
                Assignment.student_id == user_id,
            ).first()
            if a:
                a.submission_file_url = url
                db.commit()
    except Exception as e:
        logger.warning(f"_patch_target_file failed ({target_type}/{target_id}): {e}")
        db.rollback()
