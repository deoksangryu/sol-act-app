from sqlalchemy import create_engine, event
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


# SQLite 동시성 보강 — 연결마다 PRAGMA 적용.
#  WAL: 쓰기 중에도 읽기가 막히지 않음(다중 사용자 동시 조회 안정).
#  busy_timeout: 쓰기 잠금 충돌 시 즉시 실패('database is locked') 대신 최대 5초 대기.
#  synchronous=NORMAL: WAL에서 안전하면서 디스크 fsync 부담↓(쓰기 처리량↑).
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.close()

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
