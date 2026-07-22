"""오늘의 루틴 — 학생별 체크리스트 + 일자별 완료 기록. 신규 테이블(additive).

기존 plans/plan_items 무접촉. 학생 최초 GET 때 기본 3항목 lazy-seed.
"""
from sqlalchemy import Column, String, Integer, Boolean, Date, ForeignKey
from app.database import Base


class RoutineItem(Base):
    __tablename__ = "routine_items"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    sub = Column(String, nullable=True)
    reward = Column(Integer, default=5)
    sort = Column(Integer, default=0)
    active = Column(Boolean, default=True, nullable=False)


class RoutineCompletion(Base):
    __tablename__ = "routine_completions"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
