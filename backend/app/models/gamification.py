"""v2 게이미피케이션 — 박수(포인트)·커튼콜(스트릭).

전부 신규 테이블(additive). 기존 테이블/컬럼은 건드리지 않는다.
서버가 지급의 최종 권위를 가지며, 박수는 append-only 원장으로 전건 기록한다.
"""
from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey
from app.database import Base
from datetime import datetime


class PointLedger(Base):
    """박수 원장 (append-only) — +적립 / -사용을 전건 기록. 잔고 = SUM(delta)."""
    __tablename__ = "point_ledger"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)            # +적립 / -사용
    reason = Column(String, nullable=False)            # routine|submit|quiz|journal|watch|line|timer|exchange...
    ref = Column(String, nullable=True)                # 관련 엔티티 id(선택)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class Streak(Base):
    """커튼콜(연속) — 학생당 1행. 하루 1행동으로 인정, 프리즈로 하루 공백 방어."""
    __tablename__ = "streaks"

    student_id = Column(String, ForeignKey("users.id"), primary_key=True)
    current = Column(Integer, default=0, nullable=False)
    longest = Column(Integer, default=0, nullable=False)
    last_date = Column(Date, nullable=True)
    freezes = Column(Integer, default=1, nullable=False)   # 프리즈 보유(월 1 기본)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class UserActivity(Base):
    """마지막 활동 시각 — 슬럼프 감지용(학생당 1행). users 테이블 대신 신규 side-table(additive)."""
    __tablename__ = "user_activity"

    student_id = Column(String, ForeignKey("users.id"), primary_key=True)
    last_active_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
