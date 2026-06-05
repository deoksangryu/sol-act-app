"""제시대사 라이브러리 시드 — data/jesi_daesa_library.json → practice_scripts (upsert, 재실행 안전).

실행: cd backend && ./venv/bin/python seed_practice.py
"""
import json
import os

from app.database import SessionLocal, engine, Base
import app.models.practice  # noqa: F401  (모델 등록)
from app.models.practice import PracticeScript

LIB = os.path.join(os.path.dirname(__file__), "data", "jesi_daesa_library.json")


def seed():
    # 테이블 보장(런타임 백엔드가 아직 재시작 전이어도 시드 가능)
    Base.metadata.create_all(bind=engine)

    lib = json.load(open(LIB, encoding="utf-8"))
    pieces = lib["pieces"]

    db = SessionLocal()
    n_new = n_upd = 0
    try:
        for p in pieces:
            fields = dict(
                title=p["title"],
                type=p["type"],
                genre=p.get("genre"),
                emotions=p.get("emotions"),
                character_age=p.get("characterAge"),
                character_gender=p.get("characterGender"),
                situation=p.get("situation"),
                script=p["script"],
                direction=p.get("direction"),
                duration_sec=p.get("durationSec"),
                difficulty=p.get("difficulty"),
                tags=p.get("tags"),
                active=True,
            )
            existing = db.query(PracticeScript).filter(PracticeScript.id == p["id"]).first()
            if existing:
                for k, v in fields.items():
                    setattr(existing, k, v)
                n_upd += 1
            else:
                db.add(PracticeScript(id=p["id"], **fields))
                n_new += 1
        db.commit()
        total = db.query(PracticeScript).count()
        print(f"✅ practice_scripts 시드 완료 — 신규 {n_new} / 갱신 {n_upd} / 총 {total}편")
    except Exception as e:
        db.rollback()
        print(f"❌ 시드 실패: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
