from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# SQLAlchemy 엔진 생성
_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

_engine_kwargs = {
    "connect_args": _connect_args,
    "echo": settings.DEBUG,
}
# Connection pool settings for non-SQLite databases
if not settings.DATABASE_URL.startswith("sqlite"):
    _engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,  # recycle connections after 30 min
    })

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# 세션 팩토리
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스 (모든 모델이 상속)
Base = declarative_base()


# Dependency: DB 세션 가져오기
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
