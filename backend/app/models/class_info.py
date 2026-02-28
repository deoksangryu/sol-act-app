from sqlalchemy import Column, String, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base


# Many-to-many association table for students in classes
class_students = Table(
    'class_students',
    Base.metadata,
    Column('class_id', String, ForeignKey('classes.id'), primary_key=True),
    Column('student_id', String, ForeignKey('users.id'), primary_key=True)
)


class ClassInfo(Base):
    __tablename__ = "classes"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False)
    schedule = Column(String, nullable=False)  # e.g., "Mon/Wed 14:00"

    # Relationships
    teacher = relationship("User", back_populates="taught_classes", foreign_keys=[teacher_id])
    students = relationship("User", secondary=class_students, backref="enrolled_classes")
    messages = relationship("ChatMessage", back_populates="class_info")
    lessons = relationship("Lesson", back_populates="class_info")
    evaluations = relationship("Evaluation", back_populates="class_info")
    auditions = relationship("Audition", back_populates="class_info")
