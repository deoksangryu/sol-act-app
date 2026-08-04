"""작품분석(Work Analysis) — 학생이 GOTE 구조로 작품/독백을 분석 → 제출 → 강사 첨삭 → 개정(v2).

신규 테이블(additive) — create_all이 자동 생성, 기존 데이터 무접촉.

- WorkAnalysis: 작품 1개(부모). 목록/검색/상태만 스칼라, 가변 필드는 버전 payload(JSON).
- AnalysisVersion: 불변 버전 스냅샷. 개정하면 새 행(version_no+1). 학생이 payload를 채워 제출.
- AnalysisFeedback: 버전당 강사 첨삭 1개(루브릭 JSON + 3분할 요약).
- AnalysisFieldComment: 강사가 특정 칸(field_key)에 다는 코멘트(portfolio.PortfolioComment 패턴, anchor=field_key).
"""
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class WorkAnalysis(Base):
    __tablename__ = "work_analyses"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)                 # monologue | play | musical
    title = Column(String, nullable=False)                # 작품명(목록 표시)
    author = Column(String, nullable=True)                # 작가
    character = Column(String, nullable=True)             # 배역(또는 넘버명·배역)
    scene = Column(String, nullable=True)                 # 장면 위치(막·장)
    target_school = Column(String, nullable=True)         # 대비 대학(예: 한예종)
    current_version = Column(Integer, default=1, nullable=False)
    status = Column(String, default="draft", nullable=False, index=True)  # draft | submitted | reviewed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    versions = relationship(
        "AnalysisVersion", back_populates="analysis",
        cascade="all, delete-orphan", order_by="AnalysisVersion.version_no",
    )


class AnalysisVersion(Base):
    """작품분석 한 버전(불변). payload에 GOTE + 타입별 필드 전부(JSON)."""
    __tablename__ = "analysis_versions"

    id = Column(String, primary_key=True, index=True)
    analysis_id = Column(String, ForeignKey("work_analyses.id"), nullable=False, index=True)
    version_no = Column(Integer, default=1, nullable=False)
    payload = Column(JSON, nullable=False)                # {goal, other, obstacle, tactics[], expectation, beats[], invisiblePartner{}, given, subtext, theme, relations[], qa[], songType, musicMap[], ...}
    char_count = Column(Integer, default=0, nullable=False)  # 서술 필드 합산(한예종 2000자 게이지)
    status = Column(String, default="draft", nullable=False)  # draft | submitted | reviewed
    submitted_at = Column(DateTime, nullable=True)
    submission_id = Column(String, nullable=True)         # 제출 시 만든 통합인박스 Submission.id(피드백 시 done 처리용)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    analysis = relationship("WorkAnalysis", back_populates="versions")
    feedback = relationship(
        "AnalysisFeedback", back_populates="version",
        cascade="all, delete-orphan", uselist=False,
    )
    comments = relationship(
        "AnalysisFieldComment", back_populates="version",
        cascade="all, delete-orphan", order_by="AnalysisFieldComment.created_at",
    )


class AnalysisFeedback(Base):
    """강사 첨삭 — 버전당 1개. 루브릭(JSON) + 3분할 요약."""
    __tablename__ = "analysis_feedbacks"

    id = Column(String, primary_key=True, index=True)
    version_id = Column(String, ForeignKey("analysis_versions.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)   # 강사/원장
    rubric = Column(JSON, nullable=True)                  # {goalClear, obstacleReal, evidence, subtext, oral: 0~3}
    summary_good = Column(Text, nullable=True)            # 잘한 점
    summary_fix = Column(Text, nullable=True)             # 고칠 점(가장 중요한 하나)
    summary_next = Column(Text, nullable=True)            # 다음에 할 일
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    version = relationship("AnalysisVersion", back_populates="feedback")


class AnalysisFieldComment(Base):
    """강사가 특정 칸(field_key)에 다는 코멘트. PortfolioComment 패턴(anchor=field_key)."""
    __tablename__ = "analysis_field_comments"

    id = Column(String, primary_key=True, index=True)
    version_id = Column(String, ForeignKey("analysis_versions.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    field_key = Column(String, nullable=False)            # goal | other | obstacle | tactics | subtext | beat | ...
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    version = relationship("AnalysisVersion", back_populates="comments")
