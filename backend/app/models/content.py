"""배움 탭 콘텐츠 — 상식퀴즈·읽을거리·시청각·면접질문. 전부 신규 테이블(additive).

빈 테이블이면 라우터가 최초 GET 때 기본 시드를 lazy-insert(신규 테이블에만 쓰기).
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON, ForeignKey, Text
from app.database import Base
from datetime import datetime


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String, primary_key=True, index=True)
    category = Column(String, nullable=False)
    question = Column(String, nullable=False)
    options = Column(JSON, nullable=False)          # ["톨스토이","체호프",...]
    answer_index = Column(Integer, nullable=False)
    explanation = Column(String, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    sort = Column(Integer, default=0)


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(String, nullable=False, index=True)
    chosen_index = Column(Integer, nullable=False)
    correct = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class ReadingContent(Base):
    __tablename__ = "reading_contents"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    sub = Column(String, nullable=True)
    minutes = Column(Integer, default=5)
    body = Column(Text, nullable=True)   # 읽을거리 본문(상세 화면). 비면 상세 진입 시 '준비 중' 안내.
    sort = Column(Integer, default=0)


class MediaResource(Base):
    __tablename__ = "media_resources"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    sub = Column(String, nullable=True)
    url = Column(String, nullable=True)          # youtube 링크 or 업로드 영상 경로(/uploads/...)
    kind = Column(String, default="video")       # "youtube" | "video"(업로드/SSD)
    duration = Column(String, nullable=True)
    sort = Column(Integer, default=0)


class Quote(Base):
    """'오늘의 한 줄' 명대사 — 등록해두면 한국 날짜 기준 매일 순환."""
    __tablename__ = "quotes"

    id = Column(String, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    source = Column(String, nullable=True)       # "니나 · 4막" 같은 출처
    active = Column(Boolean, default=True, nullable=False)
    sort = Column(Integer, default=0)


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(String, primary_key=True, index=True)
    question = Column(String, nullable=False)
    category = Column(String, nullable=True)
    sort = Column(Integer, default=0)
