"""오늘의 루틴 — 학생별 체크리스트 + 일자별 완료 기록. 신규 테이블(additive).

기존 plans/plan_items 무접촉. 학생 최초 GET 때 기본 3항목 lazy-seed.
"""
from sqlalchemy import Column, String, Integer, Boolean, Date, ForeignKey, JSON
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


class RoutineTemplate(Base):
    """학원 공용 루틴(원장 관리). 모든 학생이 이 목록을 매일 체크. DB만 바꾸면 앱에 반영(재배포 X).
    (기존 학생별 RoutineItem 하드코딩 시드를 대체 — 완료 기록은 RoutineCompletion에 학생별로 그대로)."""
    __tablename__ = "routine_templates"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    sub = Column(String, nullable=True)
    reward = Column(Integer, default=5)
    sort = Column(Integer, default=0)
    active = Column(Boolean, default=True, nullable=False)
    student_ids = Column(JSON, nullable=True)   # 비움/null=공통(전체), 지정=그 학생들만
