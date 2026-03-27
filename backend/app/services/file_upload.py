from pathlib import Path
from fastapi import UploadFile, HTTPException
import uuid
import subprocess
import shutil
import asyncio
import threading
import aiofiles
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path("backend/uploads")
ALLOWED_VIDEO = {".mp4", ".mov", ".webm"}
ALLOWED_DOCS = {".pdf", ".jpg", ".jpeg", ".png", ".mp3", ".m4a", ".wav", ".doc", ".docx"}
ALLOWED_ALL = ALLOWED_VIDEO | ALLOWED_DOCS
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB
MAX_DOC_SIZE = 50 * 1024 * 1024  # 50MB


def validate_file_ext(filename: str) -> None:
    """Validate file extension only (for chunked upload init)."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_ALL:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_ALL))}",
        )


def validate_file(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    validate_file_ext(file.filename)

    # Check size by reading content
    # (file.size may not be available for all upload methods)


def get_max_size(filename: str) -> int:
    ext = Path(filename).suffix.lower()
    return MAX_VIDEO_SIZE if ext in ALLOWED_VIDEO else MAX_DOC_SIZE


def is_video(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_VIDEO


CHUNK_SIZE = 4 * 1024 * 1024  # 4MB chunks
MIN_VIDEO_SIZE = 1024  # 1KB — anything smaller is a failed/corrupt upload

# Limit concurrent ffmpeg processes — M4 Pro 14-core can handle more
_compression_semaphore = threading.Semaphore(5)


async def save_file(
    file: UploadFile,
    subfolder: str = "assignments",
    user_id: Optional[str] = None,
) -> Tuple[str, str]:
    """Save uploaded file and return (relative_url, original_filename).

    Files are stored under UPLOAD_DIR/subfolder/user_id/ when user_id is provided,
    making it easy to identify file ownership from the filesystem.
    """
    validate_file(file)

    unique_name = f"{uuid.uuid4().hex[:12]}_{file.filename}"
    target_dir = UPLOAD_DIR / subfolder / user_id if user_id else UPLOAD_DIR / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / unique_name

    max_size = get_max_size(file.filename)
    total = 0
    try:
        async with aiofiles.open(target_path, "wb") as f:
            while chunk := await file.read(CHUNK_SIZE):
                total += len(chunk)
                if total > max_size:
                    max_mb = max_size // (1024 * 1024)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File too large. Maximum size: {max_mb}MB",
                    )
                await f.write(chunk)
    except HTTPException:
        target_path.unlink(missing_ok=True)
        raise

    # Validate saved file is not empty/corrupt (e.g. network disconnected mid-upload)
    if total == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="업로드된 파일이 비어있습니다.")
    if is_video(file.filename) and total < MIN_VIDEO_SIZE:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="영상 파일이 손상되었거나 너무 작습니다. 다시 업로드해주세요.",
        )

    url_path = f"{subfolder}/{user_id}/{unique_name}" if user_id else f"{subfolder}/{unique_name}"
    relative_url = f"/uploads/{url_path}"
    logger.info(f"File saved: {relative_url} ({total // 1024}KB)")
    return relative_url, file.filename


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def compress_video_sync(file_path: str, user_id: Optional[str] = None) -> None:
    """Compress video with ffmpeg. Replaces original file on success."""
    src = Path(file_path)
    if not src.exists():
        logger.warning(f"compress_video: source not found: {file_path}")
        return

    if not check_ffmpeg():
        logger.warning("ffmpeg not installed, skipping video compression")
        return

    # Throttle: wait if 3 compressions already running
    logger.info(f"Waiting for compression slot: {src.name}")
    with _compression_semaphore:
        _do_compress(src, user_id)


def extract_thumbnail(video_path: str) -> Optional[str]:
    """Extract a thumbnail from a video file at 1 second. Returns thumbnail URL or None."""
    src = Path(video_path)
    if not src.exists() or not check_ffmpeg():
        return None

    thumb_path = src.with_suffix(".thumb.jpg")
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-ss", "00:00:01", "-vframes", "1",
        "-vf", "scale=320:-2",
        "-q:v", "5",
        str(thumb_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        if result.returncode == 0 and thumb_path.exists():
            # Convert absolute path to URL
            rel = str(thumb_path).replace(str(UPLOAD_DIR), "").lstrip("/")
            return f"/uploads/{rel}"
        thumb_path.unlink(missing_ok=True)
    except Exception as e:
        logger.warning(f"Thumbnail extraction failed: {e}")
        thumb_path.unlink(missing_ok=True)
    return None


def _do_compress(src: Path, user_id: Optional[str]) -> None:
    """Internal: run ffmpeg and notify on completion."""
    # Output to temp file, then swap
    tmp_out = src.with_suffix(".tmp.mp4")
    cmd = [
        "ffmpeg", "-y", "-threads", "8", "-i", str(src),
        # Select only the first video and first audio stream.
        # This skips unknown/unsupported streams (e.g. Apple apac codec, data tracks)
        # that would cause ffmpeg to fail on iPhone .mov files.
        "-map", "0:v:0", "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "28",
        "-threads", "8",
        # Landscape: cap width at 1280 (auto height). Portrait: cap height at 1280 (auto width).
        # -2 ensures the auto-calculated dimension is divisible by 2 (required by libx264).
        "-vf", "scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))'",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(tmp_out),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=600)
        if result.returncode != 0:
            logger.error(f"ffmpeg failed: {result.stderr.decode()[:500]}")
            tmp_out.unlink(missing_ok=True)
            return

        # Swap: delete original, rename compressed
        original_size = src.stat().st_size
        compressed_size = tmp_out.stat().st_size
        old_suffix = src.suffix.lower()
        src.unlink()
        # Always output as .mp4
        final_path = src.with_suffix(".mp4")
        tmp_out.rename(final_path)

        logger.info(
            f"Video compressed: {original_size // 1024}KB -> {compressed_size // 1024}KB "
            f"({100 - compressed_size * 100 // max(original_size, 1)}% reduction)"
        )

        # Update DB URLs if extension changed (.mov/.webm → .mp4)
        if old_suffix != ".mp4":
            _update_video_urls_in_db(str(src), str(final_path))

        # Send WS notification if user connected
        if user_id:
            _notify_file_ready(user_id)

    except subprocess.TimeoutExpired:
        logger.error(f"ffmpeg timeout (600s) for {src} ({src.stat().st_size // 1024}KB)")
        tmp_out.unlink(missing_ok=True)
        if user_id:
            _notify_compression_failed(user_id)
    except Exception as e:
        logger.error(f"compress_video error: {e}")
        tmp_out.unlink(missing_ok=True)
        if user_id:
            _notify_compression_failed(user_id)


def _update_video_urls_in_db(old_path: str, new_path: str) -> None:
    """Update video_url in DB when file extension changes after compression."""
    try:
        from app.database import SessionLocal
        # Convert filesystem paths to URL paths
        old_url = "/uploads/" + old_path.split(str(UPLOAD_DIR) + "/", 1)[-1] if str(UPLOAD_DIR) in old_path else None
        new_url = "/uploads/" + new_path.split(str(UPLOAD_DIR) + "/", 1)[-1] if str(UPLOAD_DIR) in new_path else None
        if not old_url or not new_url:
            return

        db = SessionLocal()
        try:
            updated = 0
            # Update portfolio video_url
            from app.models.portfolio import Portfolio
            updated += db.query(Portfolio).filter(Portfolio.video_url == old_url).update(
                {Portfolio.video_url: new_url}
            )
            # Update assignment submission_file_url
            from app.models.assignment import Assignment
            updated += db.query(Assignment).filter(Assignment.submission_file_url == old_url).update(
                {Assignment.submission_file_url: new_url}
            )
            # Update lesson_journal media_urls (JSON array of strings or {url, name} objects)
            import json
            from app.models.lesson_journal import LessonJournal
            journals = db.query(LessonJournal).filter(
                LessonJournal.media_urls.isnot(None)
            ).all()
            for j in journals:
                if not j.media_urls:
                    continue
                changed = False
                new_media = []
                for item in j.media_urls:
                    if isinstance(item, str) and item == old_url:
                        new_media.append(new_url)
                        changed = True
                    elif isinstance(item, dict) and item.get("url") == old_url:
                        new_media.append({**item, "url": new_url})
                        changed = True
                    else:
                        new_media.append(item)
                if changed:
                    j.media_urls = new_media
                    updated += 1

            if updated:
                db.commit()
                logger.info(f"Updated {updated} DB record(s): {old_url} -> {new_url}")
            else:
                db.rollback()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"_update_video_urls_in_db failed: {e}")


def _notify_file_ready(user_id: str) -> None:
    """Send WS notification and push that video compression is done."""
    try:
        from app.services.websocket_manager import manager
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(manager.send_to_user(user_id, {
                "type": "file_ready",
                "data": {"message": "영상 최적화가 완료되었습니다."},
            }))
    except Exception as e:
        logger.warning(f"Failed to send file_ready WS: {e}")
    # Create DB notification + send Web Push in a background thread
    threading.Thread(
        target=_push_file_ready,
        args=(user_id,),
        daemon=True,
    ).start()


def _push_file_ready(user_id: str) -> None:
    try:
        from app.services.notification_service import notify_user_sync
        notify_user_sync(user_id, "영상 최적화가 완료되었습니다.")
    except Exception as e:
        logger.warning(f"Failed to push file_ready: {e}")


def _notify_compression_failed(user_id: str) -> None:
    """Notify user that video compression failed (original file is preserved)."""
    try:
        from app.services.websocket_manager import manager
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(manager.send_to_user(user_id, {
                "type": "file_ready",
                "data": {"message": "영상 최적화에 실패했습니다. 원본 영상은 유지됩니다."},
            }))
    except Exception:
        pass
    threading.Thread(
        target=lambda: _push_compression_failed(user_id),
        daemon=True,
    ).start()


def _push_compression_failed(user_id: str) -> None:
    try:
        from app.services.notification_service import notify_user_sync
        notify_user_sync(user_id, "영상 최적화에 실패했습니다. 원본 영상은 유지됩니다.")
    except Exception:
        pass
