from pathlib import Path
from fastapi import UploadFile, HTTPException
import os
import uuid
import subprocess
import shutil
import asyncio
import threading
import aiofiles
import logging
from typing import Optional, Tuple
from app.config import settings

logger = logging.getLogger(__name__)

# Local fallback path (always available)
_LOCAL_UPLOAD_DIR = Path("backend/uploads")


def _resolve_upload_dir() -> Path:
    """Determine upload directory: external SSD if available, otherwise local."""
    name = settings.EXTERNAL_DRIVE_NAME
    if name:
        ext = Path(f"/Volumes/{name}/sol-act-uploads")
        if ext.parent.exists() and os.access(ext.parent, os.W_OK):
            ext.mkdir(parents=True, exist_ok=True)
            return ext
        logger.warning(f"External drive '{name}' not found at /Volumes/{name}, using local storage")
    return _LOCAL_UPLOAD_DIR


# Resolved once at import time, but can be re-checked per request via get_upload_dir()
UPLOAD_DIR = _resolve_upload_dir()


ALLOWED_VIDEO = {".mp4", ".mov", ".webm"}
ALLOWED_DOCS = {".pdf", ".jpg", ".jpeg", ".png", ".mp3", ".m4a", ".wav", ".doc", ".docx"}
ALLOWED_ALL = ALLOWED_VIDEO | ALLOWED_DOCS
MAX_VIDEO_SIZE = 10 * 1024 * 1024 * 1024  # 10GB (effectively no limit — server compresses after upload)
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
_compression_semaphore = threading.Semaphore(6)


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


ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
IMAGE_MAX_DIMENSION = 1280  # Max width or height
IMAGE_QUALITY = 80  # JPEG quality


def is_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_IMAGE


def compress_image_sync(file_path: str) -> None:
    """Compress and resize image. Replaces original file on success."""
    try:
        from PIL import Image
        src = Path(file_path)
        if not src.exists():
            return

        img = Image.open(src)

        # Convert RGBA/P to RGB for JPEG
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        # Resize if larger than max dimension
        w, h = img.size
        if w > IMAGE_MAX_DIMENSION or h > IMAGE_MAX_DIMENSION:
            img.thumbnail((IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION), Image.LANCZOS)

        original_size = src.stat().st_size

        # Save as JPEG (keep original extension if already jpg/jpeg)
        if src.suffix.lower() in ('.jpg', '.jpeg'):
            out_path = src
        else:
            out_path = src.with_suffix('.jpg')
        img.save(out_path, 'JPEG', quality=IMAGE_QUALITY, optimize=True)
        compressed_size = out_path.stat().st_size

        # Remove original if extension changed (e.g. .png → .jpg)
        if out_path != src:
            src.unlink(missing_ok=True)

        logger.info(
            f"Image compressed: {original_size // 1024}KB -> {compressed_size // 1024}KB "
            f"({100 - compressed_size * 100 // max(original_size, 1)}% reduction)"
        )
    except ImportError:
        logger.warning("Pillow not installed, skipping image compression")
    except Exception as e:
        logger.warning(f"Image compression failed: {e}")


def check_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _check_videotoolbox() -> bool:
    """Check if VideoToolbox hardware encoder is available (macOS only)."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-encoders"],
            capture_output=True, timeout=5
        )
        return b"h264_videotoolbox" in result.stdout
    except Exception:
        return False


_has_videotoolbox: Optional[bool] = None


def has_videotoolbox() -> bool:
    global _has_videotoolbox
    if _has_videotoolbox is None:
        _has_videotoolbox = _check_videotoolbox()
        if _has_videotoolbox:
            logger.info("VideoToolbox hardware encoder available")
    return _has_videotoolbox


def _probe_video(file_path: str) -> Optional[dict]:
    """Probe video with ffprobe to get codec, resolution, bitrate."""
    try:
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", "-show_format", str(file_path),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        if result.returncode == 0:
            import json
            return json.loads(result.stdout)
    except Exception as e:
        logger.warning(f"ffprobe failed: {e}")
    return None


def _should_skip_compression(probe_data: dict) -> bool:
    """Check if video is already optimized and compression can be skipped."""
    if not probe_data:
        return False
    streams = probe_data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    if not video_stream:
        return False

    codec = video_stream.get("codec_name", "")
    width = int(video_stream.get("width", 9999))
    height = int(video_stream.get("height", 9999))
    max_dim = max(width, height)

    # Get bitrate (stream or format level)
    bitrate = int(video_stream.get("bit_rate", 0))
    if not bitrate:
        bitrate = int(probe_data.get("format", {}).get("bit_rate", 0))
    bitrate_mbps = bitrate / 1_000_000 if bitrate else 0

    # Skip if already H.264, resolution <= 1280, and bitrate <= 3 Mbps
    if codec == "h264" and max_dim <= IMAGE_MAX_DIMENSION and 0 < bitrate_mbps <= 3:
        logger.info(f"Skipping compression: already optimized ({codec}, {width}x{height}, {bitrate_mbps:.1f}Mbps)")
        return True
    return False


def compress_video_sync(file_path: str, user_id: Optional[str] = None) -> None:
    """Compress video with ffmpeg. Replaces original file on success."""
    src = Path(file_path)
    if not src.exists():
        logger.warning(f"compress_video: source not found: {file_path}")
        return

    if not check_ffmpeg():
        logger.warning("ffmpeg not installed, skipping video compression")
        return

    # Probe video to check if compression is needed
    probe = _probe_video(file_path)
    if _should_skip_compression(probe):
        # Re-mux to .mp4 container if needed (fast, no re-encoding)
        if src.suffix.lower() != ".mp4":
            final_path = src.with_suffix(".mp4")
            try:
                remux_cmd = [
                    "ffmpeg", "-y", "-i", str(src),
                    "-c", "copy", "-movflags", "+faststart",
                    str(final_path),
                ]
                result = subprocess.run(remux_cmd, capture_output=True, timeout=60)
                if result.returncode == 0:
                    src.unlink(missing_ok=True)
                    _update_video_urls_in_db(str(src), str(final_path))
                    logger.info(f"Video re-muxed (no compression needed): {src.name} → {final_path.name}")
                else:
                    logger.warning(f"Re-mux failed, falling through to compression: {result.stderr.decode(errors='replace')[:200]}")
                    final_path.unlink(missing_ok=True)
                    # Fall through to full compression below
                    with _compression_semaphore:
                        _do_compress(src, user_id)
                    return
            except Exception as e:
                logger.warning(f"Re-mux error: {e}")
                final_path.unlink(missing_ok=True)
        if user_id:
            _notify_file_ready(user_id)
        return

    # Throttle: wait if too many compressions already running
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
    scale_filter = "scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))'"

    # libx264 with CRF gives better size control than VideoToolbox fixed bitrate
    cmd = [
        "ffmpeg", "-y", "-threads", "8", "-i", str(src),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "28",
        "-threads", "8",
        "-vf", scale_filter,
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(tmp_out),
    ]
    encoder = "libx264"

    logger.info(f"Compressing {src.name} with {encoder}")

    # Get duration for progress tracking
    duration_sec = _get_duration(str(src))

    try:
        import re, time as _time
        proc = subprocess.Popen(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )

        # Read stderr in a background thread to avoid deadlock
        stderr_lines: list = []
        def _read_stderr():
            assert proc.stderr
            for line in proc.stderr:
                stderr_lines.append(line)
                if user_id and duration_sec and b"time=" in line:
                    m = re.search(rb"time=(\d+):(\d+):(\d+)\.(\d+)", line)
                    if m:
                        t = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
                        pct = min(99, int(t * 100 / duration_sec))
                        _notify_compression_progress(user_id, pct)

        reader = threading.Thread(target=_read_stderr, daemon=True)
        reader.start()

        # Wait with timeout
        proc.wait(timeout=600)
        reader.join(timeout=5)

        if proc.returncode != 0:
            stderr_data = b"".join(stderr_lines)
            logger.error(f"ffmpeg failed: {stderr_data.decode(errors='replace')[:500]}")
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
            f"Video compressed ({encoder}): {original_size // 1024}KB -> {compressed_size // 1024}KB "
            f"({100 - compressed_size * 100 // max(original_size, 1)}% reduction)"
        )

        # Update DB URLs if extension changed (.mov/.webm → .mp4)
        if old_suffix != ".mp4":
            _update_video_urls_in_db(str(src), str(final_path))

        # Send WS notification if user connected
        if user_id:
            _notify_file_ready(user_id)

    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)
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
            from app.models.portfolio import Portfolio, PortfolioVideo
            updated += db.query(Portfolio).filter(Portfolio.video_url == old_url).update(
                {Portfolio.video_url: new_url}
            )
            # Update portfolio_videos
            updated += db.query(PortfolioVideo).filter(PortfolioVideo.video_url == old_url).update(
                {PortfolioVideo.video_url: new_url}
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


def _get_duration(file_path: str) -> Optional[float]:
    """Get video duration in seconds via ffprobe."""
    try:
        cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", file_path]
        result = subprocess.run(cmd, capture_output=True, timeout=10)
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            return float(data.get("format", {}).get("duration", 0))
    except Exception:
        pass
    return None


def _notify_compression_progress(user_id: str, pct: int) -> None:
    """Send compression progress via WebSocket."""
    try:
        from app.services.websocket_manager import manager
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            loop.call_soon_threadsafe(
                asyncio.ensure_future,
                manager.send_to_user(user_id, {
                    "type": "compression_progress",
                    "data": {"progress": pct},
                })
            )
    except Exception:
        pass


def _notify_file_ready(user_id: str) -> None:
    """Send WS notification and push that video compression is done."""
    try:
        from app.services.websocket_manager import manager
        # Background tasks run in a separate thread — get the main event loop safely
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            loop.call_soon_threadsafe(
                asyncio.ensure_future,
                manager.send_to_user(user_id, {
                    "type": "file_ready",
                    "data": {"message": "영상 최적화가 완료되었습니다."},
                })
            )
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
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            loop.call_soon_threadsafe(
                asyncio.ensure_future,
                manager.send_to_user(user_id, {
                    "type": "file_ready",
                    "data": {"message": "영상 최적화에 실패했습니다. 원본 영상은 유지됩니다."},
                })
            )
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
