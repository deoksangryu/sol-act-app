from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    evaluator_id = Column(String, ForeignKey("users.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    period = Column(String, nullable=False)  # e.g. "2025-01", "2025-1학기"
    acting_skill = Column(Integer, nullable=False)  # 1-5
    expressiveness = Column(Integer, nullable=False)  # 1-5
    teamwork = Column(Integer, nullable=False)  # 1-5
    effort = Column(Integer, nullable=False)  # 1-5
    attendance_score = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("User", foreign_keys=[student_id], back_populates="evaluations_received")
    evaluator = relationship("User", foreign_keys=[evaluator_id])
    class_info = relationship("ClassInfo", back_populates="evaluations")
