"""시간표·클래스 일괄 적용 (2026-06 개편).

- 반 이름변경/신규생성, 로스터 갱신(명단 외 학생은 그 반에서 제거), 세션별 시간표(요일·시작·과목·강사·지점) 설정.
- 미가입 학생(박시은·이태경)은 제외(추후 추가). 종료시간은 저장 안 함(생성 시 +2h 내부 기본).
- 각 반 수업을 '내일부터' 재생성(generate_lessons_for_class — 미래 정규수업 정리 후 4주치).
실행: cd backend && ./venv/bin/python apply_timetable.py
"""
from app.database import SessionLocal
from app.models.class_info import ClassInfo
from app.models.user import User, UserRole
from app.routers.classes import generate_lessons_for_class
import uuid

T = {  # 강사 이름 → id
    '김도훈': 'te4f2765', '김세희': 't81960e3', '박진혁': 'tcb7d1a5',
    '김주영': 't790dbb0', '송민국': 'tc64b6f3', '김효신': 'td567d95',
    '김수민 원장': 'ddf97612',
}
NAME = {v: k for k, v in T.items()}

# (요일, 시작, subject_enum, 과목라벨, 강사, 지점)
CLASSES = [
    ('cls2d473a5', '고등입시B반', ['이성민', '임윤서', '민석준', '문규태', '정환희', '김서윤'],
     [('월', '19:00', 'acting', '연기', '김도훈', '부평'),
      ('화', '19:00', 'acting', '기본기&제시', '김수민 원장', '부평'),
      ('금', '20:00', 'dance', '무용', '김주영', '부평'),
      ('토', '15:00', 'musical', '뮤지컬', '송민국', '산곡'),
      ('일', '12:00', 'acting', '연기', '김도훈', '부평')]),
    ('cls6742bcc', '고등입시A반', ['최지민', '이지효', '김종우', '김다인', '남궁다한'],
     [('화', '20:00', 'dance', '무용', '김효신', '부평'),
      ('목', '19:00', 'acting', '기본기&제시', '김수민 원장', '부평'),
      ('금', '19:00', 'acting', '연기', '김세희', '산곡'),
      ('토', '14:00', 'musical', '뮤지컬', '박진혁', '부평'),
      ('일', '12:00', 'acting', '연기', '김세희', '산곡')]),
    ('cls170ac6b', '예고입시(산곡)', ['김서연', '김예온', '김태우', '이예준', '이하린'],
     [('화', '17:30', 'acting', '연기', '김도훈', '산곡'),
      ('토', '12:00', 'musical', '뮤지컬', '송민국', '산곡'),
      ('일', '17:00', 'dance', '무용', '김주영', '산곡')]),
    ('clsb949b03', '예고입시(부평)', ['한가희'],  # 박시은 추후
     [('수', '20:00', 'dance', '무용', '김주영', '부평'),
      ('토', '12:00', 'musical', '뮤지컬', '박진혁', '부평'),
      ('일', '15:00', 'acting', '연기', '김도훈', '부평')]),
    ('cls50afe58', '예비입시(부평)', ['김소율', '김유진', '황윤하'],  # 이태경 추후
     [('화', '17:30', 'dance', '무용', '김효신', '부평'),
      ('토', '17:00', 'musical', '뮤지컬', '박진혁', '부평'),
      ('일', '18:30', 'acting', '연기', '김도훈', '부평')]),
    ('cls6b7924c', '예비입시(산곡)', ['김예서'],
     [('화', '20:00', 'acting', '연기', '김도훈', '산곡'),
      ('토', '18:00', 'musical', '뮤지컬', '송민국', '산곡'),
      ('일', '20:00', 'dance', '무용', '김주영', '산곡')]),
    ('cls69d5254', '재입시', ['배서연', '지승훈', '이기성'],
     [('월', '11:00', 'acting', '연기', '김세희', '부평'),
      ('화', '14:00', 'musical', '뮤지컬&제시', '김수민 원장', '부평'),
      ('수', '12:00', 'dance', '무용', '김주영', '부평'),
      ('목', '14:00', 'musical', '뮤지컬&제시', '김수민 원장', '부평'),
      ('금', '15:00', 'acting', '연기', '김세희', '부평')]),
    ('NEW', '중등매체연기반', ['김서연'],
     [('일', '15:00', 'acting', '중등매체연기', '김세희', '산곡'),
      ('월', '17:30', 'acting', '중등매체연기', '김수민 원장', '부평')]),
]


def build(slots):
    schedule, st = [], {}
    desc_lines = []
    for day, start, subj, label, tname, loc in slots:
        tid = T[tname]
        schedule.append({'day': day, 'start_time': start, 'subject': subj,
                         'subject_label': label, 'teacher_id': tid, 'location': loc})
        # subject_teachers: 표준 과목키 우선, 비표준(&제시·중등)은 강사 visibility 위해 별도 키
        key = subj if label in ('연기', '무용', '뮤지컬') else 'basics'
        st.setdefault(key, tid)
        # 모든 강사가 본인 화면에 반이 보이도록 — 누락 강사 보조키로 포함
        if tid not in st.values():
            st[f'aux{len(st)}'] = tid
        desc_lines.append(f"{day} {label} {start} {loc} ({tname})")
    return schedule, st, "\n".join(desc_lines)


def main():
    db = SessionLocal()
    try:
        sid = {u.name: u.id for u in db.query(User).filter(User.role == UserRole.STUDENT).all()}
        total_lessons = 0
        for cid, name, roster, slots in CLASSES:
            schedule, st, desc = build(slots)
            if cid == 'NEW':
                cls = ClassInfo(id=f"cls{uuid.uuid4().hex[:7]}", name=name, description=desc,
                                subject_teachers=st, schedule=schedule)
                db.add(cls)
                db.flush()
            else:
                cls = db.query(ClassInfo).filter(ClassInfo.id == cid).first()
                cls.name, cls.description = name, desc
                cls.subject_teachers, cls.schedule = st, schedule
            # 로스터 설정(가입자만; 명단 외 학생은 자동 제거)
            roster_ids = [sid[n] for n in roster if n in sid]
            missing = [n for n in roster if n not in sid]
            cls.students = db.query(User).filter(User.id.in_(roster_ids)).all() if roster_ids else []
            db.flush()
            n = generate_lessons_for_class(cls, db)
            total_lessons += n
            print(f"  {cls.name:14} | 학생 {len(cls.students)}명{' (미가입 제외:'+','.join(missing)+')' if missing else ''} | 세션 {len(slots)} | 수업 {n}개")
        db.commit()
        print(f"\n✅ 적용 완료 — 반 {len(CLASSES)}개, 수업 {total_lessons}개 재생성(내일부터 4주)")
    except Exception as e:
        db.rollback()
        print(f"❌ 실패(롤백): {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
