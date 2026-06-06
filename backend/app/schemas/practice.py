"""제시대사 연습 스키마 — 학생에겐 '대사(script)'만 노출(상황·감정·연기포인트는 숨김)."""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ScriptLine(BaseModel):
    speaker: str
    text: str


class PracticeStudentView(BaseModel):
    """학생 노출용 — 분석/연기는 학생 몫이라 대사와 형식만 준다."""
    id: str
    type: str                       # 독백 / 2인대사 / 보고읽기 / 지정연기
    script: List[ScriptLine]

    class Config:
        from_attributes = True


class PerformanceView(BaseModel):
    """현재 제시대사에 학생이 올린 연기영상(선택) — 업로드/피드백 상태."""
    portfolio_id: str
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    upload_status: str                              # ready | uploading | failed
    comment_count: int = 0
    has_feedback: bool = False


class CurrentResponse(BaseModel):
    current: Optional[PracticeStudentView] = None   # 현재(가장 최근 뽑은) 제시대사
    performance: Optional[PerformanceView] = None    # 현재 대사에 올린 연기영상(없으면 None)
    can_draw_new: bool                              # 새로 받기 가능 여부(쿨다운)
    cooldown_seconds_remaining: int                 # 남은 쿨다운(초)
    next_draw_at: Optional[datetime] = None         # 다음 받기 가능 시각
    drawn_at: Optional[datetime] = None             # 현재 대사를 받은 시각
    total_scripts: int                              # 전체 제시대사 수
    seen_count: int                                 # 이 학생이 본 수
    exhausted: bool = False                         # 모든 제시대사를 다 본 상태(→ 더 요청하기)
