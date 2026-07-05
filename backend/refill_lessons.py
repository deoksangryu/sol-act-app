"""전체 반의 정규수업 재생성(내일 이후 4주치) — 비어있는 7월 채움.

기존 timetable 적용과 동일한 generate_lessons_for_class 사용:
- 미래(내일 이후) 정규 SCHEDULED 수업만 정리 후 재생성(중복 방지).
- 오늘·과거·완료·취소·보강·특강은 보존. 스케줄/로스터는 건드리지 않음.
실행: cd backend && ./venv/bin/python refill_lessons.py
"""
from app.database import SessionLocal
from app.models.class_info import ClassInfo
from app.routers.classes import generate_lessons_for_class


def main():
    db = SessionLocal()
    try:
        classes = db.query(ClassInfo).all()
        total = 0
        for cls in classes:
            n = generate_lessons_for_class(cls, db)
            total += n
            print(f"  {cls.name:24} | 수업 {n}개")
        db.commit()
        print(f"\n✅ 반 {len(classes)}개, 총 {total}개 정규수업 재생성(내일 이후 4주치)")
    except Exception as e:
        db.rollback()
        print(f"❌ 실패(롤백): {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
