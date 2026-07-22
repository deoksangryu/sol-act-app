"""교환소 — 박수(포인트) 사용. 전부 신규 테이블(additive)."""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from app.database import Base
from datetime import datetime


class ExchangeItem(Base):
    __tablename__ = "exchange_items"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    cost = Column(Integer, nullable=False)
    icon = Column(String, nullable=True)
    kind = Column(String, nullable=False)   # feedback|practice_room|mock_interview|freeze|custom
    active = Column(Boolean, default=True, nullable=False)
    sort = Column(Integer, default=0)


class ExchangeOrder(Base):
    __tablename__ = "exchange_orders"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(String, nullable=False)
    item_name = Column(String, nullable=False)
    cost = Column(Integer, nullable=False)
    status = Column(String, default="ordered", nullable=False)  # ordered|fulfilled|canceled
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
