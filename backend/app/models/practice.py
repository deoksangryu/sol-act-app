"""제시대사 연습 — 대본 라이브러리(PracticeScript) + 학생별 뽑기 이력(PracticeDraw).

- PracticeScript: 미리 생성된 제시대사 풀(런타임 0원 서빙). 학생에겐 대사(script)만 노출.
- PracticeDraw: 학생이 뽑은 기록. (a) 중복 방지(본 것 추적), (b) 1시간 쿨다운(최근 drawn_at),
  (c) 현재 보여줄 대사(가장 최근 뽑기)를 모두 담당.
"""
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON
from app.database import Base
from datetime import datetime


class PracticeScript(Base):
    __tablename__ = "practice_scripts"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)              # 독백 / 2인대사
    genre = Column(String, nullable=True)
    emotions = Column(JSON, nullable=True)             # list[str]
    character_age = Column(String, nullable=True)
    character_gender = Column(String, nullable=True)   # 남 / 여 / 무관
    situation = Column(Text, nullable=True)            # (학생 비노출) 상황 설명
    script = Column(JSON, nullable=False)              # list[{speaker, text}] — 학생에게 보여주는 대사
    direction = Column(Text, nullable=True)            # (학생 비노출) 연기 포인트
    duration_sec = Column(Integer, nullable=True)
    difficulty = Column(String, nullable=True)         # 입문 / 중급 / 고급
    tags = Column(JSON, nullable=True)                 # list[str]
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PracticeDraw(Base):
    __tablename__ = "practice_draws"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    script_id = Column(String, ForeignKey("practice_scripts.id"), nullable=False)
    drawn_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class PracticeRequest(Base):
    """학생이 '더 요청하기'를 누른 기록 — 학생ID 기준 중복방지(이름 변경 우회 차단)용."""
    __tablename__ = "practice_requests"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
