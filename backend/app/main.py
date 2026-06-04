import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.config import settings
from app.database import engine, Base

logger = logging.getLogger(__name__)

# Import routers
from app.routers import (
    auth, users, assignments, diet, classes, chat, qna, notices, notifications,
    lessons, journals, attendance, evaluations, portfolios, auditions, private_lessons,
    ws, upload, admin, push, praise_stickers, music, badges
)

# DB 테이블 생성 (개발 환경용, 프로덕션에서는 Alembic 사용)
Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성 — 프로덕션에서는 API 문서 비활성화
app = FastAPI(
    title=settings.APP_NAME,
    description="Acting academy management platform with AI-powered feedback",
    version=settings.VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    redirect_slashes=False,  # We handle slash normalization in middleware below
)


# 글로벌 예외 핸들러 — 스택 트레이스 노출 방지
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "서버 내부 오류가 발생했습니다."},
    )


# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.effective_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Trailing-slash normalization: try current path first, if no route matches,
# toggle the trailing slash and retry internally. This avoids 307 redirects
# which strip Authorization headers in cross-origin (ngrok) environments.
from starlette.routing import Match

@app.middleware("http")
async def normalize_trailing_slash(request, call_next):
    path = request.scope.get("path", "")
    # Only normalize /api/ paths (skip /uploads/, /ws/, etc.)
    if path.startswith("/api/"):
        # Check if current path matches any route
        matched = any(
            route.matches(request.scope)[0] != Match.NONE
            for route in app.routes
        )
        if not matched:
            # Toggle trailing slash and try again
            alt = path.rstrip("/") if path.endswith("/") else path + "/"
            request.scope["path"] = alt
    return await call_next(request)


# ngrok 경고 우회 + CORS 보장 미들웨어
@app.middleware("http")
async def add_extra_headers(request, call_next):
    from starlette.responses import Response as StarletteResponse
    origin = request.headers.get("origin")

    # Handle CORS preflight (OPTIONS) directly — ngrok can strip CORSMiddleware headers
    if request.method == "OPTIONS" and origin and origin in settings.effective_cors_origins:
        return StarletteResponse(
            status_code=204,
            headers={
                "access-control-allow-origin": origin,
                "access-control-allow-credentials": "true",
                "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "access-control-allow-headers": "authorization, content-type, ngrok-skip-browser-warning",
                "access-control-max-age": "86400",
                "ngrok-skip-browser-warning": "true",
            },
        )

    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    # Ensure CORS headers on all responses (307 redirects, errors, etc.)
    if origin and origin in settings.effective_cors_origins:
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"
    return response


# 라우터 등록
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["Assignments"])
app.include_router(diet.router, prefix="/api/diet", tags=["Diet"])
app.include_router(classes.router, prefix="/api/classes", tags=["Classes"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(qna.router, prefix="/api/qna", tags=["Q&A"])
app.include_router(notices.router, prefix="/api/notices", tags=["Notices"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(lessons.router, prefix="/api/lessons", tags=["Lessons"])
app.include_router(journals.router, prefix="/api/journals", tags=["Journals"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["Evaluations"])
app.include_router(portfolios.router, prefix="/api/portfolios", tags=["Portfolios"])
app.include_router(auditions.router, prefix="/api/auditions", tags=["Auditions"])
app.include_router(private_lessons.router, prefix="/api/private-lessons", tags=["Private Lessons"])
app.include_router(ws.router, prefix="/ws", tags=["WebSocket"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin (localhost only)"])
app.include_router(push.router, prefix="/api/push", tags=["Push Notifications"])
app.include_router(praise_stickers.router, prefix="/api/praise-stickers", tags=["Praise Stickers"])
app.include_router(music.router, prefix="/api/music", tags=["Music"])
app.include_router(badges.router, prefix="/api", tags=["Badges"])

# Static file serving for uploads — with security headers + Range support
# Serves from external SSD if available, falls back to local directory
import os
os.makedirs("backend/uploads", exist_ok=True)


class SecureStaticFiles(StaticFiles):
    """StaticFiles with security headers. Preserves Range request support."""

    async def __call__(self, scope, receive, send):
        async def send_with_headers(message):
            if message.get("type") == "http.response.start":
                headers = dict(message.get("headers", []))
                ct = headers.get(b"content-type", b"").decode()
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"content-security-policy", b"default-src 'none'"),
                ]
                # Force download for non-media types
                if not ct.startswith(("image/", "video/", "audio/")):
                    path = scope.get("path", "")
                    fname = path.split("/")[-1]
                    extra.append((b"content-disposition", f'attachment; filename="{fname}"'.encode()))
                message["headers"] = list(message.get("headers", [])) + extra
            await send(message)
        await super().__call__(scope, receive, send_with_headers)


from starlette.responses import Response as StarletteFileResponse


def _serve_file_ranged(file_path: str, request: Request, extra_headers: dict):
    """Serve a file with HTTP Range (206) support.

    iOS Safari / WKWebView require Range responses to play <video>/<audio>.
    Falls back to a normal 200 FileResponse when there is no Range header.
    """
    import mimetypes
    from starlette.responses import Response, FileResponse as SFileResponse
    media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    base = {"Accept-Ranges": "bytes", **extra_headers}

    range_header = request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        file_size = os.path.getsize(file_path)
        try:
            start_s, end_s = range_header[len("bytes="):].split("-", 1)
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else file_size - 1
        except ValueError:
            start, end = 0, file_size - 1
        start = max(0, start)
        end = min(end, file_size - 1)
        if start > end:
            return Response(status_code=416, headers={**base, "Content-Range": f"bytes */{file_size}"})
        with open(file_path, "rb") as f:
            f.seek(start)
            data = f.read(end - start + 1)
        return Response(
            content=data, status_code=206, media_type=media_type,
            headers={**base, "Content-Range": f"bytes {start}-{end}/{file_size}", "Content-Length": str(len(data))},
        )

    resp = SFileResponse(file_path, media_type=media_type)
    for k, v in base.items():
        resp.headers[k] = v
    return resp


@app.middleware("http")
async def serve_uploads(request: Request, call_next):
    """Serve /uploads/ files from external SSD first, then local (Range-enabled)."""
    path = request.url.path
    if not path.startswith("/uploads/"):
        return await call_next(request)

    rel = path[len("/uploads/"):]  # strip prefix

    # Cache headers for static uploads (images/videos don't change after upload).
    # NOTE: no restrictive CSP here — it can interfere with media playback.
    cache_headers = {
        "x-content-type-options": "nosniff",
        "cache-control": "public, max-age=31536000, immutable",
    }

    # Try external SSD first
    name = settings.EXTERNAL_DRIVE_NAME
    if name:
        ext_file = os.path.join(f"/Volumes/{name}/sol-act-uploads", rel)
        if os.path.isfile(ext_file):
            return _serve_file_ranged(ext_file, request, cache_headers)

    # Fall back to local
    local_file = os.path.join("backend/uploads", rel)
    if os.path.isfile(local_file):
        return _serve_file_ranged(local_file, request, cache_headers)

    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.middleware("http")
async def serve_music_files(request: Request, call_next):
    """Serve /music-files/ audio from the external SSD `music` folder.

    Explicit HTTP Range support (206 Partial Content) — iOS WKWebView requires
    Range/Accept-Ranges to play and seek <audio> reliably.
    """
    path = request.url.path
    if not path.startswith("/music-files/"):
        return await call_next(request)

    import mimetypes
    from starlette.responses import Response, FileResponse as SFileResponse

    rel = path[len("/music-files/"):]  # already percent-decoded by Starlette
    name = settings.EXTERNAL_DRIVE_NAME
    if not name:
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    base = os.path.realpath(f"/Volumes/{name}/music")
    music_file = os.path.realpath(os.path.join(base, rel))
    # Path-traversal guard: resolved file must stay inside the music folder
    if not (music_file == base or music_file.startswith(base + os.sep)) or not os.path.isfile(music_file):
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    media_type = mimetypes.guess_type(music_file)[0] or "audio/mpeg"
    common = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
    }

    range_header = request.headers.get("range")
    if range_header and range_header.startswith("bytes="):
        file_size = os.path.getsize(music_file)
        try:
            start_s, end_s = range_header[len("bytes="):].split("-", 1)
            start = int(start_s) if start_s else 0
            end = int(end_s) if end_s else file_size - 1
        except ValueError:
            start, end = 0, file_size - 1
        start = max(0, start)
        end = min(end, file_size - 1)
        if start > end:
            return Response(status_code=416, headers={**common, "Content-Range": f"bytes */{file_size}"})
        with open(music_file, "rb") as f:
            f.seek(start)
            data = f.read(end - start + 1)
        return Response(
            content=data, status_code=206, media_type=media_type,
            headers={**common, "Content-Range": f"bytes {start}-{end}/{file_size}", "Content-Length": str(len(data))},
        )

    resp = SFileResponse(music_file, media_type=media_type)
    for k, v in common.items():
        resp.headers[k] = v
    return resp


# Admin dashboard (local access only)
@app.get("/admin")
def admin_dashboard():
    return FileResponse("static/admin.html")


# Start background scheduler on startup
@app.on_event("startup")
async def startup_scheduler():
    from app.services.scheduler import start_scheduler
    asyncio.create_task(start_scheduler())


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "SOL-ACT API",
        "version": settings.VERSION,
        "docs": "/docs",
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sol-act-backend"}


# API 정보
@app.get("/api/info")
def api_info():
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health"
        }
    }
