from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from app.models.plan import PlanType


class PlanItemCreate(BaseModel):
    content: str
    sort_order: int = 0


class PlanItemUpsert(BaseModel):
    """학생이 체크리스트를 수정할 때 보내는 항목. id가 있으면 기존 항목(done 보존),
    없으면 새 항목. 목록에서 빠진 기존 항목은 삭제된다."""
    id: Optional[str] = None
    content: str
    done: Optional[bool] = None
    sort_order: int = 0


class PlanItemResponse(BaseModel):
    id: str
    content: str
    done: bool
    sort_order: int

    class Config:
        from_attributes = True


class PlanBase(BaseModel):
    plan_type: PlanType
    plan_date: date


class PlanCreate(PlanBase):
    student_id: str
    items: List[PlanItemCreate] = []


class PlanUpdate(BaseModel):
    items: Optional[List[PlanItemUpsert]] = None  # 학생: 체크리스트 항목 교체(diff)
    teacher_comment: Optional[str] = None         # 교사·원장 전용


class PlanItemToggle(BaseModel):
    done: bool


class PlanResponse(PlanBase):
    id: str
    student_id: str
    student_name: str
    teacher_comment: Optional[str] = None
    items: List[PlanItemResponse] = []
    total_count: int
    done_count: int
    progress: float  # 0.0 ~ 100.0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
