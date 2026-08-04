"""한국(KST, UTC+9) 기준 날짜 경계 헬퍼.

v2의 DateTime 컬럼들(point_ledger·submissions·practice_sessions·quiz_answers…)은
datetime.utcnow()(naive UTC)로 저장된다. '오늘'·'이번 달'은 **한국 달력 기준**이어야 하므로,
KST 자정을 naive-UTC로 환산해 그 컬럼들과 비교한다. (한국은 DST 없음 → 고정 +9 정확.)

Date 컬럼(streaks.last_date·routine_completions.date)은 today_kst()로 쓰고 읽어 내부 일관.
"""
from datetime import datetime, date, timedelta, timezone

KST = timezone(timedelta(hours=9))  # 한국 표준시(고정)


def kst_now() -> datetime:
    """현재 KST 시각(aware)."""
    return datetime.now(KST)


def today_kst() -> date:
    """현재 한국 달력 날짜."""
    return datetime.now(KST).date()


def kst_day_start_utc(d: date | None = None) -> datetime:
    """KST 날짜(기본=오늘)의 자정을 naive-UTC로 환산 — utcnow 저장 컬럼 비교용."""
    if d is None:
        d = today_kst()
    start_kst = datetime(d.year, d.month, d.day, tzinfo=KST)
    return start_kst.astimezone(timezone.utc).replace(tzinfo=None)


def kst_month_start_utc(d: date | None = None) -> datetime:
    """KST 날짜(기본=오늘)가 속한 달 1일 자정(KST)을 naive-UTC로."""
    if d is None:
        d = today_kst()
    start_kst = datetime(d.year, d.month, 1, tzinfo=KST)
    return start_kst.astimezone(timezone.utc).replace(tzinfo=None)
