"""시험 일정 — 원장 입력, 전 학생 홈 D-day 반영. 기존 auditions와 병행(보존).

신규 테이블(additive).
"""
from sqlalchemy import Column, String, Date, DateTime, ForeignKey
from app.database import Base
from datetime import datetime


class ExamSchedule(Base):
    __tablename__ = "exam_schedules"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)         # "한예종 연기과 실기"
    exam_date = Column(Date, nullable=False, index=True)
    note = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
