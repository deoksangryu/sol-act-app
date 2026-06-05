"""
SQLite -> PostgreSQL 일회성 무손실 마이그레이션.
- SQLite는 읽기만(원본 절대 불변 → 실패해도 즉시 롤백 가능).
- SQLAlchemy Table 객체로 복사 → enum/JSON/datetime/bool 타입 자동 정합.
- 재실행 안전(target public 스키마를 리셋 후 재생성).
실행: cd backend && ./venv/bin/python migrate_to_postgres.py
"""
import os
import sys
import importlib
import pkgutil
import sqlite3

from sqlalchemy import create_engine, text

SQLITE_URL = "sqlite:///./sol_act.db"
PG_URL = os.environ.get("PG_URL", "postgresql+psycopg2://deryu@localhost:5432/sol_act")

# 1) 전 모델 모듈 import → Base.metadata에 모든 테이블 등록(invite_codes 포함)
import app.models as models_pkg  # noqa: E402
for _m in pkgutil.iter_modules(models_pkg.__path__):
    importlib.import_module(f"app.models.{_m.name}")
from app.database import Base  # noqa: E402

src = create_engine(SQLITE_URL)
dst = create_engine(PG_URL)

# 2) SQLite 실제 테이블이 전부 메타데이터에 잡히는지(누락=데이터 손실 위험 → 중단)
sc = sqlite3.connect("sol_act.db")
sqlite_tables = {r[0] for r in sc.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
sc.close()
meta_tables = {t.name for t in Base.metadata.sorted_tables}
missing = sqlite_tables - meta_tables
if missing:
    print(f"❌ 메타데이터에 없는 SQLite 테이블(손실 위험): {missing} — 중단")
    sys.exit(1)
print(f"테이블 정합 OK — SQLite {len(sqlite_tables)}개 ⊆ 메타데이터 {len(meta_tables)}개")

# 3) target 완전 초기화(재실행 안전: 남은 enum 타입까지 제거) + 스키마 생성
with dst.begin() as d:
    d.execute(text("DROP SCHEMA public CASCADE"))
    d.execute(text("CREATE SCHEMA public"))
Base.metadata.create_all(bind=dst)
print("Postgres 스키마 생성 완료(테이블/enum/JSON 등)")

# 4) 복사 — FK 트리거 끄고(superuser) FK 순서 무관하게 벌크
with src.connect() as s, dst.begin() as d:
    d.execute(text("SET session_replication_role = replica"))
    for t in Base.metadata.sorted_tables:
        rows = [dict(r) for r in s.execute(t.select()).mappings().all()]
        if rows:
            d.execute(t.insert(), rows)
    d.execute(text("SET session_replication_role = DEFAULT"))
print("데이터 복사 완료")

# 5) 검증 — 테이블별 행수 비교(불일치 1건이라도 → 실패코드)
print("\n=== 행수 검증 (SQLite vs Postgres) ===")
ok = True
mismatches = []
with src.connect() as s, dst.connect() as d:
    for t in Base.metadata.sorted_tables:
        sn = s.execute(text(f'SELECT COUNT(*) FROM "{t.name}"')).scalar()
        pn = d.execute(text(f'SELECT COUNT(*) FROM "{t.name}"')).scalar()
        if sn != pn:
            ok = False
            mismatches.append((t.name, sn, pn))
        if sn or pn:
            mark = "✅" if sn == pn else "❌"
            print(f"  {mark} {t.name}: SQLite {sn} / PG {pn}")

# 6) enum 스팟체크(이름 매핑 정상 여부)
print("\n=== enum 스팟체크 ===")
with dst.connect() as d:
    for q, label in [
        ("SELECT DISTINCT role FROM users", "users.role"),
        ("SELECT DISTINCT meal_type FROM diet_logs", "diet_logs.meal_type"),
        ("SELECT DISTINCT status FROM attendances", "attendances.status"),
    ]:
        try:
            vals = [r[0] for r in d.execute(text(q)).fetchall()]
            print(f"  {label}: {vals}")
        except Exception as e:
            print(f"  {label}: (조회 실패 {str(e)[:50]})")

print("\n결과:", "✅ 전체 행수 일치 — 마이그레이션 성공" if ok else f"❌ 불일치 {mismatches} — 롤백 필요")
sys.exit(0 if ok else 2)
