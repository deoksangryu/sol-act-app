"""통합 제출 인덱스 — 5종(녹음·영상·일지·식단·면접)을 한 곳에 모아 강사 단일 인박스.

신규 테이블(additive). 기존 portfolios/diet_logs/journals 등은 불변 — v2 제출 플로우가
이 테이블에만 INSERT/UPDATE 한다. 리드타임 = created_at ↔ first_feedback_at.
"""
from sqlalchemy import Column, String, DateTime, ForeignKey
from app.database import Base
from datetime import datetime


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)  # 담당강사(있으면)
    kind = Column(String, nullable=False)          # recording|video|journal|diet|interview
    title = Column(String, nullable=False)
    note = Column(String, nullable=True)           # 학생이 남긴 한 마디
    status = Column(String, nullable=False, default="open", index=True)  # open|done
    feedback = Column(String, nullable=True)       # 강사 피드백 본문
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    first_feedback_at = Column(DateTime, nullable=True)  # 최초 피드백 시각(리드타임 소스)
