from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum
from app.database import Base
from app.models.user import UserRole
from datetime import datetime


class InviteCode(Base):
    __tablename__ = "invite_codes"

    code = Column(String, primary_key=True, index=True)
    role = Column(SQLEnum(UserRole), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    used_by = Column(String, nullable=True)
    memo = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
