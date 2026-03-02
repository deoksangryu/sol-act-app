from fastapi import APIRouter, Depends, UploadFile, File, Query, BackgroundTasks
from app.models.user import User
from app.utils.auth import get_current_user
from app.services.file_upload import save_file, is_video, compress_video_sync, UPLOAD_DIR

router = APIRouter()


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subfolder: str = Query("assignments"),
    current_user: User = Depends(get_current_user),
):
    url, filename = await save_file(file, subfolder=subfolder)

    # Start background video compression for video files
    video = is_video(filename)
    if video:
        file_path = str(UPLOAD_DIR / subfolder / url.split("/")[-1])
        background_tasks.add_task(compress_video_sync, file_path, current_user.id)

    return {"url": url, "filename": filename, "is_video": video}
