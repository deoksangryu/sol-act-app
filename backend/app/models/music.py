from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Track(Base):
    """무용 음악 라이브러리 트랙."""
    __tablename__ = "music_tracks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)  # 현대무용 / 발레 / 재즈댄스 / 한국무용 등
    mood = Column(String, nullable=True)       # 차분한 / 강렬한 / 밝은 등
    duration = Column(String, nullable=True)   # "2:48" 형태
    file_url = Column(String, nullable=True)   # 업로드된 음원 경로 (시드 데이터는 비어 있을 수 있음)
    thumbnail_url = Column(String, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    requests = relationship(
        "MusicDownloadRequest", back_populates="track", cascade="all, delete-orphan"
    )


class MusicDownloadRequest(Base):
    """학생의 음원 다운로드 권한 요청."""
    __tablename__ = "music_download_requests"

    id = Column(String, primary_key=True, index=True)
    track_id = Column(String, ForeignKey("music_tracks.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    purpose = Column(String, nullable=False)  # 자유무용 입시 연습 / 워크숍 준비 / 콩쿠르 준비 / 수업 복습
    status = Column(SQLEnum(RequestStatus), nullable=False, default=RequestStatus.PENDING)
    response_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    responded_at = Column(DateTime, nullable=True)

    # Relationships
    track = relationship("Track", back_populates="requests")
    student = relationship("User", foreign_keys=[student_id])
