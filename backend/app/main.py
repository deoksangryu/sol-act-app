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
    ws, upload, admin, push, praise_stickers
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

# Static file serving for uploads — with security headers
import os
os.makedirs("backend/uploads", exist_ok=True)

_uploads_app = StaticFiles(directory="backend/uploads")

@app.middleware("http")
async def uploads_security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/uploads/"):
        # Prevent uploaded files from executing scripts
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Force download for non-media types
        ct = response.headers.get("content-type", "")
        if not ct.startswith(("image/", "video/", "audio/")):
            fname = request.url.path.split("/")[-1]
            response.headers["Content-Disposition"] = f'attachment; filename="{fname}"'
    return response

app.mount("/uploads", _uploads_app, name="uploads")


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
