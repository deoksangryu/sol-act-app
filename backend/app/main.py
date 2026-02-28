from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base

# Import routers
from app.routers import (
    auth, users, assignments, diet, classes, chat, qna, notices, notifications,
    lessons, journals, attendance, evaluations, portfolios, auditions
)

# DB 테이블 생성 (개발 환경용, 프로덕션에서는 Alembic 사용)
Base.metadata.create_all(bind=engine)

# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="Acting academy management platform with AI-powered feedback",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ngrok 브라우저 경고 우회 미들웨어
@app.middleware("http")
async def add_ngrok_headers(request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
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


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Muse Academy API",
        "version": settings.VERSION,
        "docs": "https://sol-backend.ngrok.dev/docs",
        "frontend": "https://sol-manager.ngrok.app"
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "muse-academy-backend"}


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
