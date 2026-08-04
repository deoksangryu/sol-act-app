"""갈채 뱃지 — 학생별 획득 기록(append-only). 정의(카탈로그)는 코드 상수로 둔다.

신규 테이블(additive). praise_stickers(이모지 메시지)와 무관 — 진짜 뱃지 데이터는 여기.
강사수여(성장상)는 granted_by 채워 수동 발급, 자동 룰은 코드에서 평가.
"""
from sqlalchemy import Column, String, DateTime, ForeignKey
from app.database import Base
from datetime import datetime


class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    badge_code = Column(String, nullable=False)     # BADGE_DEFS의 code
    granted_by = Column(String, ForeignKey("users.id"), nullable=True)  # 강사수여 시 강사 id
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
