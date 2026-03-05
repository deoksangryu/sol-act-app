import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date, datetime

from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.models.invite_code import InviteCode
from app.models.class_info import ClassInfo
from app.models.lesson import Lesson, LessonStatus, LessonType, Subject
from app.models.assignment import Assignment
from app.utils.auth import get_password_hash, create_access_token

# In-memory SQLite for tests
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --- Auth helpers ---
def make_auth_header(user_id: str) -> dict:
    token = create_access_token(data={"sub": user_id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seed_users(db):
    users = [
        User(id="s1", name="김배우", email="student@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.STUDENT, avatar="https://example.com/s1.png"),
        User(id="s2", name="이연기", email="lee@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.STUDENT, avatar="https://example.com/s2.png"),
        User(id="t1", name="박선생", email="teacher@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.TEACHER, avatar="https://example.com/t1.png"),
        User(id="d1", name="최원장", email="director@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.DIRECTOR, avatar="https://example.com/d1.png"),
    ]
    db.add_all(users)
    db.commit()
    return {u.id: u for u in users}


@pytest.fixture()
def student_headers(seed_users):
    return make_auth_header("s1")


@pytest.fixture()
def student2_headers(seed_users):
    return make_auth_header("s2")


@pytest.fixture()
def teacher_headers(seed_users):
    return make_auth_header("t1")


@pytest.fixture()
def director_headers(seed_users):
    return make_auth_header("d1")


@pytest.fixture()
def seed_class(db, seed_users):
    cls = ClassInfo(
        id="c1", name="입시 A반", description="심화반",
        subject_teachers={"acting": "t1"}, schedule="월/수/금 18:00"
    )
    db.add(cls)
    db.commit()
    cls.students.append(seed_users["s1"])
    cls.students.append(seed_users["s2"])
    db.commit()
    return cls


@pytest.fixture()
def seed_lesson(db, seed_class):
    lesson = Lesson(
        id="lsn001", class_id="c1", date=date.today(),
        start_time="18:00", end_time="20:00",
        status=LessonStatus.SCHEDULED, lesson_type=LessonType.REGULAR,
        subject=Subject.ACTING, teacher_id="t1", location="연습실 A"
    )
    db.add(lesson)
    db.commit()
    return lesson


@pytest.fixture()
def seed_assignment(db, seed_users):
    a = Assignment(
        id="asgn001", title="독백 연습", description="셰익스피어 독백 1편 녹화",
        due_date=datetime(2025, 12, 31), student_id="s1", status="pending"
    )
    db.add(a)
    db.commit()
    return a


# --- AI mocking ---
# Patch where the function is USED (router imports), not where it's DEFINED
@pytest.fixture(autouse=True)
def mock_ai(monkeypatch):
    monkeypatch.setattr("app.routers.diet.ai_analyze_diet", lambda desc, img=None: {"calories": 500, "advice": "좋은 식단입니다."})
    monkeypatch.setattr("app.routers.assignments.analyze_monologue", lambda text: "훌륭한 독백입니다.")
    monkeypatch.setattr("app.routers.qna.ask_ai_tutor", lambda q: "AI 답변입니다.")
    monkeypatch.setattr("app.routers.journals.generate_journal_feedback", lambda content, jtype: "피드백입니다.")
    monkeypatch.setattr("app.routers.evaluations.generate_evaluation_summary", lambda data: "평가 요약입니다.")
    monkeypatch.setattr("app.routers.portfolios.analyze_portfolio", lambda t, d, c: "포트폴리오 피드백입니다.")
    monkeypatch.setattr("app.routers.auditions.generate_audition_tips", lambda t, d, at: "오디션 팁입니다.")
