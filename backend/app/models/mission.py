"""오늘의 미션 — 학원 공용(원장 관리). DB만 바꾸면 앱 홈에 달리 보임(재배포 X).

type이 완료판정·이동 대상을 결정: video(영상 제출) / journal(연습 일지) / quiz(상식 퀴즈).
보상값(reward)은 표시용 힌트 — 실제 점수는 각 도메인 행동이 지급한다.
"""
from sqlalchemy import Column, String, Integer, Boolean
from app.database import Base


class Mission(Base):
    __tablename__ = "missions"

    id = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)      # video | journal | quiz
    title = Column(String, nullable=False)
    sub = Column(String, nullable=True)
    reward = Column(Integer, default=5)         # 표시용 (+N 👏)
    sort = Column(Integer, default=0)
    active = Column(Boolean, default=True, nullable=False)
