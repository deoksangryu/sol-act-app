from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.music import RequestStatus


class TrackCreate(BaseModel):
    title: str
    category: str
    mood: Optional[str] = None
    duration: Optional[str] = None
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class MyRequestInfo(BaseModel):
    """현재 학생 본인의 요청 상태 (트랙 응답에 임베드)."""
    id: str
    status: RequestStatus
    purpose: str
    response_note: Optional[str] = None
    created_at: datetime
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrackResponse(BaseModel):
    id: str
    title: str
    category: str
    mood: Optional[str] = None
    duration: Optional[str] = None
    file_url: Optional[str] = None               # 학생에게는 null (정적 경로 비노출)
    stream_url: Optional[str] = None             # 서명된 인앱 청취 스트림(전원)
    thumbnail_url: Optional[str] = None
    created_at: datetime
    my_request: Optional[MyRequestInfo] = None  # 학생: 본인 요청 상태
    pending_count: int = 0                       # 선생님: 이 트랙의 승인 대기 수

    class Config:
        from_attributes = True


class RequestCreate(BaseModel):
    track_id: str
    purpose: str


class RequestRespond(BaseModel):
    status: RequestStatus  # approved / rejected
    response_note: Optional[str] = None


class RequestResponse(BaseModel):
    id: str
    track_id: str
    track_title: str
    student_id: str
    student_name: str
    purpose: str
    status: RequestStatus
    response_note: Optional[str] = None
    created_at: datetime
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True
