"""연습 세션 — 타이머/음악재생 시간 append-only 기록. 월누적·타이머 박수의 근거.

신규 테이블(additive). 기존 practice_scripts(제시대사)와 무관한 별개 테이블.
"""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from app.database import Base
from datetime import datetime


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    seconds = Column(Integer, nullable=False, default=0)
    source = Column(String, nullable=False, default="timer")  # timer|music
    ref = Column(String, nullable=True)                        # track_id 등
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
