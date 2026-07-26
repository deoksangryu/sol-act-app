"""AI 상대역 연습 — 저장된 장면(SceneRehearsal) + 앱 설정(AppSetting).

- SceneRehearsal: 학생이 생성한 장면(내 대사+상대 대사+TTS음성URL+연기시간)을 저장.
  한 번 생성하면 크레딧을 쓰지만, 이후 '불러오기'로 무제한 재연습(추가 비용 0).
  음성 mp3는 UPLOAD_DIR/tts/(외장 SSD)에 저장돼 있고 turns[].audioUrl로 참조.
- AppSetting: key-value 런타임 설정(원장이 조절). scene_daily_limit = 하루 생성 제한.
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from app.database import Base
from datetime import datetime


class SceneRehearsal(Base):
    __tablename__ = "scene_rehearsals"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)             # 목록 표시용(상대 설정 or 첫 대사)
    partner_hint = Column(String, nullable=True)       # 상대 인물 설정
    voice = Column(String, nullable=True)              # 사용된 보이스(성별/나이)
    turns = Column(JSON, nullable=False)               # [{speaker, text, audioUrl?, sec?}]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=False)


class InterviewRevision(Base):
    """AI 면접 첨삭 결과 저장 — 생성 성공 시 서버가 커밋해 지속(화면 이탈해도 유실 없음).
    이후 '지난 첨삭' 목록으로 재열람. (기존엔 화면 state에만 있어 이탈 시 영구 소멸했음.)"""
    __tablename__ = "interview_revisions"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    question = Column(Text, nullable=True)     # 면접 질문
    answer = Column(Text, nullable=False)      # 학생 원본 답변
    revised = Column(Text, nullable=True)      # 개선 답변
    feedback = Column(JSON, nullable=True)     # [개선점]
    summary = Column(Text, nullable=True)      # 한 줄 총평
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
