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


def validate_file(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_ALL:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_ALL))}",
        )

    # Check size by reading content
    # (file.size may not be available for all upload methods)


def get_max_size(filename: str) -> int:
    ext = Path(filename).suffix.lower()
    return MAX_VIDEO_SIZE if ext in ALLOWED_VIDEO else MAX_DOC_SIZE


def is_video(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_VIDEO


CHUNK_SIZE = 4 * 1024 * 1024  # 4MB chunks

# Limit concurrent ffmpeg processes to prevent CPU/memory overload
_compression_semaphore = threading.Semaphore(3)


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

    url_path = f"{subfolder}/{user_id}/{unique_name}" if user_id else f"{subfolder}/{unique_name}"
    relative_url = f"/uploads/{url_path}"
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


def _do_compress(src: Path, user_id: Optional[str]) -> None:
    """Internal: run ffmpeg and notify on completion."""
    # Output to temp file, then swap
    tmp_out = src.with_suffix(".tmp.mp4")
    cmd = [
        "ffmpeg", "-y", "-threads", "3", "-i", str(src),
        "-c:v", "libx264", "-preset", "fast", "-crf", "28",
        "-threads", "3",
        "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
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
        src.unlink()
        # Always output as .mp4
        final_path = src.with_suffix(".mp4")
        tmp_out.rename(final_path)

        # If original had a different extension, the URL might differ.
        # But since we store the original filename in the URL, we keep it as-is
        # and handle .mp4 extension at the URL level if needed.
        # For simplicity, if src already was .mp4, final_path == src (same name).
        # If src was .mov/.webm, the file is now .mp4 at a slightly different path.
        logger.info(
            f"Video compressed: {original_size // 1024}KB -> {compressed_size // 1024}KB "
            f"({100 - compressed_size * 100 // max(original_size, 1)}% reduction)"
        )

        # Send WS notification if user connected
        if user_id:
            _notify_file_ready(user_id)

    except subprocess.TimeoutExpired:
        logger.error(f"ffmpeg timeout for {src}")
        tmp_out.unlink(missing_ok=True)
    except Exception as e:
        logger.error(f"compress_video error: {e}")
        tmp_out.unlink(missing_ok=True)


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
