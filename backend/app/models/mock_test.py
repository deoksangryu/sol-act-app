"""모의테스트 — 원장이 생성하고 학생 순번을 정함. 학생이 음원을 업로드하면 원장이 한곳에서
다운로드하고, 원장이 학생별 시험영상을 업로드하면 학생이 본인 영상을 조회한다.

신규 테이블(additive) — create_all이 자동 생성, 기존 데이터 무접촉.
"""
from sqlalchemy import Column, String, Date, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class MockTest(Base):
    __tablename__ = "mock_tests"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)              # "10월 모의테스트"
    test_date = Column(Date, nullable=True, index=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="open", nullable=False)  # "open" | "closed"
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    entries = relationship(
        "MockTestEntry", back_populates="mock_test",
        cascade="all, delete-orphan", order_by="MockTestEntry.sort_order",
    )
    videos = relationship(
        "MockTestVideo", back_populates="mock_test",
        cascade="all, delete-orphan", order_by="MockTestVideo.sort_order",
    )


class MockTestEntry(Base):
    """모의테스트 참여 학생 1명 = 1행. 순번(sort_order)과 학생 업로드 음원(audio_url)을 보관."""
    __tablename__ = "mock_test_entries"

    id = Column(String, primary_key=True, index=True)
    mock_test_id = Column(String, ForeignKey("mock_tests.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    sort_order = Column(Integer, default=0, nullable=False)   # 원장이 정한 순번
    audio_url = Column(String, nullable=True)                 # 학생이 올린 음원(업로드 시 패치)
    audio_submitted_at = Column(DateTime, nullable=True)
    status = Column(String, default="waiting", nullable=False)  # "waiting" | "submitted"

    mock_test = relationship("MockTest", back_populates="entries")


class MockTestVideo(Base):
    """원장이 학생별로 올리는 시험영상(학생당 여러 개 가능). 학생은 본인 것만 조회."""
    __tablename__ = "mock_test_videos"

    id = Column(String, primary_key=True, index=True)
    mock_test_id = Column(String, ForeignKey("mock_tests.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    video_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    mock_test = relationship("MockTest", back_populates="videos")
