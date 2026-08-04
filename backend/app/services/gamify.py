"""공용 게이미피케이션 서비스 — 박수 지급·커튼콜·활동기록의 단일 진실.

모든 완료 행동(제출·타이머·퀴즈·일지·루틴·시청)은 여기를 거쳐 지급된다.
- 서버가 지급 최종 권위, 일일 상한 60 강제(과연습 차단).
- 커밋은 호출자 책임(호출 라우터의 트랜잭션에 합류). 각 완료 엔드포인트는 요청당 record_action을
  1회만 호출하고 곧 커밋하므로 상한은 커밋된 이전 지급 기준으로 정확히 계산된다(세션 autoflush=False).
전부 신규 테이블(point_ledger·streaks·user_activity)만 읽고 쓴다 — 기존 테이블 무접촉.
"""
from datetime import datetime, date, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
import uuid

from app.models.gamification import PointLedger, Streak, UserActivity
from app.utils.timezone import today_kst, kst_day_start_utc

DAILY_CAP = 60  # 일일 박수 적립 상한(한국 자정 리셋)


def _today_start() -> datetime:
    # created_at은 utcnow(naive UTC) 저장 → '오늘'은 KST 자정을 UTC로 환산해 비교.
    return kst_day_start_utc()


def today_earned(db: Session, sid: str) -> int:
    return int(db.query(func.coalesce(func.sum(PointLedger.delta), 0)).filter(
        PointLedger.student_id == sid, PointLedger.delta > 0, PointLedger.created_at >= _today_start(),
    ).scalar() or 0)


def balance(db: Session, sid: str) -> int:
    return int(db.query(func.coalesce(func.sum(PointLedger.delta), 0)).filter(
        PointLedger.student_id == sid,
    ).scalar() or 0)


def award_points(db: Session, sid: str, reason: str, amount: int, ref: str | None = None) -> int:
    """박수 지급(일일 상한 적용). 실제 지급된 값 반환. 커밋은 호출자."""
    earned = today_earned(db, sid)
    grant = max(0, min(max(0, int(amount)), DAILY_CAP - earned))
    if grant > 0:
        db.add(PointLedger(id=f"pl{uuid.uuid4().hex[:12]}", student_id=sid, delta=grant, reason=reason, ref=ref))
    return grant


def spend_points(db: Session, sid: str, amount: int, reason: str, ref: str | None = None) -> bool:
    """박수 사용(교환소). 잔고 부족 시 False. 커밋은 호출자."""
    if amount <= 0 or balance(db, sid) < amount:
        return False
    db.add(PointLedger(id=f"pl{uuid.uuid4().hex[:12]}", student_id=sid, delta=-int(amount), reason=reason, ref=ref))
    return True


def bump_streak(db: Session, sid: str) -> Streak:
    """커튼콜(하루 1행동) 갱신. 프리즈로 하루 공백 방어. 커밋은 호출자. 하루=KST 달력일."""
    today = today_kst()
    s = db.query(Streak).filter(Streak.student_id == sid).first()
    if s is None:
        s = Streak(student_id=sid, current=1, longest=1, last_date=today, freezes=1)
        db.add(s)
    elif s.last_date != today:
        if s.last_date == today - timedelta(days=1):
            s.current += 1
        elif s.freezes > 0 and s.last_date == today - timedelta(days=2):
            s.freezes -= 1  # 프리즈로 하루 공백 방어
            s.current += 1
        else:
            s.current = 1
        s.longest = max(s.longest, s.current)
        s.last_date = today
    return s


def touch_activity(db: Session, sid: str) -> None:
    """마지막 활동 시각 갱신(슬럼프 감지용). 커밋은 호출자."""
    a = db.query(UserActivity).filter(UserActivity.student_id == sid).first()
    now = datetime.utcnow()
    if a is None:
        db.add(UserActivity(student_id=sid, last_active_at=now))
    else:
        a.last_active_at = now


def record_action(db: Session, sid: str, reason: str, amount: int, ref: str | None = None) -> tuple[int, int]:
    """완료 행동 원스톱: 박수 지급 + 커튼콜 + 활동 갱신. (granted, streak_current) 반환. 커밋은 호출자."""
    granted = award_points(db, sid, reason, amount, ref)
    s = bump_streak(db, sid)
    touch_activity(db, sid)
    return granted, s.current
