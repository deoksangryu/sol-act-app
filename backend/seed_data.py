"""
Initial seed data for SOL-ACT database
Run this script to populate the database with mock users and data
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, Base, engine
from app.models.user import User, UserRole
from app.models.assignment import Assignment, AssignmentStatus
from app.models.diet import DietLog, MealType
from app.models.class_info import ClassInfo
from app.models.chat import ChatMessage
from app.models.qna import Question, Answer
from app.models.notice import Notice
from app.models.notification import Notification, NotificationType
from app.models.lesson import Lesson, LessonStatus, LessonType, Subject
from app.models.lesson_journal import LessonJournal, JournalType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.evaluation import Evaluation
from app.models.portfolio import Portfolio, PortfolioComment, PortfolioCategory
from app.models.audition import Audition, AuditionChecklist, AuditionType, AuditionStatus
from app.models.private_lesson import PrivateLessonRequest, RequestStatus
from app.utils.auth import get_password_hash


def seed_users():
    db = SessionLocal()

    existing = db.query(User).first()
    if existing:
        print("⚠️  Users already exist. Skipping seed.")
        db.close()
        return

    print("🌱 Seeding users...")

    users = [
        User(id="s1", name="김배우", email="student@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.STUDENT, avatar="https://picsum.photos/200"),
        User(id="s2", name="이연기", email="lee@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.STUDENT, avatar="https://picsum.photos/202"),
        User(id="s3", name="최무대", email="choi@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.STUDENT, avatar="https://picsum.photos/203"),
        User(id="s4", name="박감정", email="park@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.STUDENT, avatar="https://picsum.photos/204"),
        User(id="t1", name="박선생", email="teacher@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.TEACHER, avatar="https://picsum.photos/201"),
        User(id="t2", name="김무용", email="dance@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.TEACHER, avatar="https://picsum.photos/205"),
        User(id="d1", name="최원장", email="director@muse.com",
             hashed_password=get_password_hash("password123"),
             role=UserRole.DIRECTOR, avatar="https://picsum.photos/206"),
    ]

    for user in users:
        db.add(user)

    db.commit()
    print(f"✅ Created {len(users)} users")

    print("\n📝 Test Credentials (all passwords: password123):")
    print("-" * 50)
    for user in users:
        print(f"{user.role.value.upper():10} | {user.email:20} | {user.name}")

    db.close()


def seed_classes():
    db = SessionLocal()

    existing = db.query(ClassInfo).first()
    if existing:
        print("⚠️  Classes already exist. Skipping seed.")
        db.close()
        return

    print("🌱 Seeding classes...")

    c1 = ClassInfo(id="c1", name="입시 A반 (심화)",
                   description="한예종/중앙대 목표 심화 연기 클래스입니다.",
                   subject_teachers={"acting": "t1", "musical": "t1", "dance": "t2"},
                   schedule="월/수/금 18:00")
    c2 = ClassInfo(id="c2", name="뮤지컬 특기반",
                   description="뮤지컬 보컬 및 무용 기초를 배우는 클래스입니다.",
                   subject_teachers={"musical": "t1", "dance": "t2"},
                   schedule="토 14:00")
    c3 = ClassInfo(id="c3", name="기초반",
                   description="연기 입문자를 위한 기초 클래스입니다.",
                   subject_teachers={"acting": "t1"},
                   schedule="화/목 16:00")

    db.add_all([c1, c2, c3])
    db.commit()

    s1 = db.query(User).filter(User.id == "s1").first()
    s2 = db.query(User).filter(User.id == "s2").first()
    s3 = db.query(User).filter(User.id == "s3").first()
    s4 = db.query(User).filter(User.id == "s4").first()

    c1.students.extend([s1, s2])
    c2.students.extend([s1, s3])
    c3.students.extend([s3, s4])
    db.commit()

    print("✅ Created 3 classes with student assignments")
    db.close()


def seed_assignments():
    db = SessionLocal()

    existing = db.query(Assignment).first()
    if existing:
        print("⚠️  Assignments already exist. Skipping seed.")
        db.close()
        return

    print("🌱 Seeding assignments...")
    now = datetime.utcnow()

    assignments = [
        Assignment(
            id="asgn001", title="햄릿 독백 연습",
            description="햄릿의 'To be or not to be' 독백을 한국어로 번안하여 연습해오세요.",
            due_date=now + timedelta(days=7), student_id="s1",
            status=AssignmentStatus.PENDING,
        ),
        Assignment(
            id="asgn002", title="감정 일기 제출",
            description="일주일간의 감정 변화를 기록한 감정 일기를 제출해주세요.",
            due_date=now - timedelta(days=1), student_id="s1",
            status=AssignmentStatus.SUBMITTED,
            submission_text="월요일: 설렘, 긴장, 기대감으로 시작한 한 주였습니다...",
        ),
        Assignment(
            id="asgn003", title="즉흥 연기 영상 촬영",
            description="주어진 상황(카페에서 오랜 친구를 우연히 만남)에서 2분 이내의 즉흥 연기를 촬영하여 제출해주세요.",
            due_date=now - timedelta(days=5), student_id="s1",
            status=AssignmentStatus.GRADED,
            submission_text="안녕... 너 혹시 민수 아니야? 와, 진짜 오랜만이다!",
            grade="A", feedback="자연스러운 감정 전환이 좋았습니다.",
            ai_analysis="감정 표현이 자연스럽고 적절한 리액션을 보여주고 있습니다.",
        ),
    ]

    db.add_all(assignments)
    db.commit()
    print(f"✅ Created {len(assignments)} assignments")
    db.close()


def seed_diet_logs():
    db = SessionLocal()
    existing = db.query(DietLog).first()
    if existing:
        print("⚠️  Diet logs already exist. Skipping seed.")
        db.close()
        return

    print("🌱 Seeding diet logs...")
    now = datetime.utcnow()

    logs = [
        DietLog(id="diet001", student_id="s1",
                date=now.replace(hour=8, minute=30), meal_type=MealType.BREAKFAST,
                description="통밀빵 토스트, 스크램블 에그, 아메리카노",
                calories=420, ai_advice="아침으로 적절한 단백질과 탄수화물 조합입니다."),
        DietLog(id="diet002", student_id="s1",
                date=now.replace(hour=12, minute=30), meal_type=MealType.LUNCH,
                description="닭가슴살 샐러드, 현미밥, 된장국",
                calories=550, ai_advice="균형 잡힌 점심입니다!"),
    ]

    db.add_all(logs)
    db.commit()
    print(f"✅ Created {len(logs)} diet logs")
    db.close()


def seed_notices():
    db = SessionLocal()
    existing = db.query(Notice).first()
    if existing:
        print("⚠️  Notices already exist. Skipping seed.")
        db.close()
        return

    print("🌱 Seeding notices...")
    notices = [
        Notice(id="notice001", title="2025년 겨울 특강 안내",
               content="겨울방학 특강이 12월 26일부터 1월 15일까지 진행됩니다.",
               author="최원장", important=True),
        Notice(id="notice002", title="연기 발표회 일정 공지",
               content="이번 학기 연기 발표회가 2월 중순으로 예정되어 있습니다.",
               author="박선생", important=True),
        Notice(id="notice003", title="학원 운영시간 변경 안내",
               content="1월부터 학원 운영시간이 오전 10시~오후 10시로 변경됩니다.",
               author="최원장", important=False),
    ]
    db.add_all(notices)
    db.commit()
    print(f"✅ Created {len(notices)} notices")
    db.close()


def seed_notifications():
    db = SessionLocal()
    existing = db.query(Notification).first()
    if existing:
        print("⚠️  Notices already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding notifications...")
    notifications = [
        Notification(id="noti001", user_id="s1", type=NotificationType.INFO,
                     message="새로운 과제가 등록되었습니다: 햄릿 독백 연습", read=False),
        Notification(id="noti002", user_id="s1", type=NotificationType.SUCCESS,
                     message="즉흥 연기 영상 촬영 과제가 채점되었습니다.", read=False),
    ]
    db.add_all(notifications)
    db.commit()
    print(f"✅ Created {len(notifications)} notifications")
    db.close()


def seed_chat_messages():
    db = SessionLocal()
    existing = db.query(ChatMessage).first()
    if existing:
        print("⚠️  Chat messages already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding chat messages...")
    messages = [
        ChatMessage(id="msg001", class_id="c1", sender_id="t1",
                    content="안녕하세요! 이번 주 수업에서는 감정 표현 심화를 다룰 예정입니다."),
        ChatMessage(id="msg002", class_id="c1", sender_id="s1",
                    content="네 선생님! 준비하겠습니다 😊"),
    ]
    db.add_all(messages)
    db.commit()
    print(f"✅ Created {len(messages)} chat messages")
    db.close()


def seed_qna():
    db = SessionLocal()
    existing = db.query(Question).first()
    if existing:
        print("⚠️  Q&A already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding Q&A...")
    question = Question(
        id="q001", title="감정 몰입이 어려울 때 어떻게 하나요?",
        content="연기할 때 슬픈 장면에서 감정이 잘 안 나옵니다. 어떻게 하면 좋을까요?",
        author_id="s1", views=5,
    )
    db.add(question)
    db.commit()
    answer = Answer(
        id="ans001", question_id="q001",
        content="감정 몰입이 어려울 때는 '감각 기억(Sense Memory)' 기법을 활용해보세요.",
        author_name="박선생", author_role="teacher", is_ai=False,
    )
    db.add(answer)
    db.commit()
    print("✅ Created 1 question with 1 answer")
    db.close()


def seed_lessons():
    db = SessionLocal()
    existing = db.query(Lesson).first()
    if existing:
        print("⚠️  Lessons already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding lessons...")
    from datetime import date
    today = date.today()
    lessons = []

    # c1: 월/수/금 연기 수업
    for offset in range(-14, 14):
        d = today + timedelta(days=offset)
        if d.weekday() in [0, 2, 4]:
            status = LessonStatus.COMPLETED if d < today else LessonStatus.SCHEDULED
            lessons.append(Lesson(
                id=f"lsn{d.strftime('%m%d')}{d.weekday()}",
                class_id="c1", date=d,
                start_time="18:00", end_time="20:00",
                status=status, lesson_type=LessonType.REGULAR,
                subject=Subject.ACTING, teacher_id="t1",
                location="연습실 A",
            ))

    # c2: 토요일 뮤지컬 수업
    for offset in range(-14, 14):
        d = today + timedelta(days=offset)
        if d.weekday() == 5:
            status = LessonStatus.COMPLETED if d < today else LessonStatus.SCHEDULED
            lessons.append(Lesson(
                id=f"lsnsat{d.strftime('%m%d')}",
                class_id="c2", date=d,
                start_time="14:00", end_time="16:00",
                status=status, lesson_type=LessonType.REGULAR,
                subject=Subject.MUSICAL, teacher_id="t1",
                location="연습실 B",
            ))

    db.add_all(lessons)
    db.commit()
    print(f"✅ Created {len(lessons)} lessons")
    db.close()


def seed_attendance():
    db = SessionLocal()
    existing = db.query(Attendance).first()
    if existing:
        print("⚠️  Attendance already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding attendance...")
    completed_lessons = db.query(Lesson).filter(Lesson.status == LessonStatus.COMPLETED).all()
    records = []
    student_ids_c1 = ["s1", "s2"]
    student_ids_c2 = ["s1", "s3"]
    statuses = [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE]

    idx = 0
    for lesson in completed_lessons:
        sids = student_ids_c1 if lesson.class_id == "c1" else student_ids_c2
        for sid in sids:
            s = statuses[idx % len(statuses)]
            records.append(Attendance(
                id=f"att{idx:04d}",
                lesson_id=lesson.id, student_id=sid,
                status=s, marked_by="t1",
            ))
            idx += 1

    db.add_all(records)
    db.commit()
    print(f"✅ Created {len(records)} attendance records")
    db.close()


def seed_journals():
    db = SessionLocal()
    existing = db.query(LessonJournal).first()
    if existing:
        print("⚠️  Journals already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding journals...")
    completed = db.query(Lesson).filter(Lesson.status == LessonStatus.COMPLETED).limit(3).all()
    journals = []
    for i, lesson in enumerate(completed):
        journals.append(LessonJournal(
            id=f"jrn{i:03d}t",
            lesson_id=lesson.id, author_id="t1",
            journal_type=JournalType.TEACHER,
            content="오늘 수업에서는 감정 몰입 연습을 진행했습니다.",
            objectives="감정 표현의 깊이를 높이고 자연스러운 대사 전달 연습",
            next_plan="다음 수업에서는 2인 장면 연기를 진행할 예정입니다.",
        ))
        journals.append(LessonJournal(
            id=f"jrn{i:03d}s",
            lesson_id=lesson.id, author_id="s1",
            journal_type=JournalType.STUDENT,
            content="오늘 즉흥 연기가 재밌었지만 감정 전환이 어려웠습니다.",
        ))
    db.add_all(journals)
    db.commit()
    print(f"✅ Created {len(journals)} journals")
    db.close()


def seed_evaluations():
    db = SessionLocal()
    existing = db.query(Evaluation).first()
    if existing:
        print("⚠️  Evaluations already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding evaluations...")
    evaluations = [
        Evaluation(
            id="eval001", student_id="s1", evaluator_id="t1", class_id="c1",
            subject=Subject.ACTING, period="2025-1학기",
            acting_skill=4, expressiveness=5, creativity=4, teamwork=4, effort=5,
            comment="감정 표현이 뛰어나고 수업 참여도가 높습니다.",
        ),
        Evaluation(
            id="eval002", student_id="s2", evaluator_id="t1", class_id="c1",
            subject=Subject.ACTING, period="2025-1학기",
            acting_skill=3, expressiveness=3, creativity=3, teamwork=5, effort=4,
            comment="팀워크가 좋고 성실합니다.",
        ),
        Evaluation(
            id="eval003", student_id="s1", evaluator_id="t1", class_id="c1",
            subject=Subject.ACTING, period="2025-2학기",
            acting_skill=5, expressiveness=5, creativity=5, teamwork=5, effort=5,
            comment="전 학기 대비 눈에 띄는 성장을 보여주었습니다.",
        ),
    ]
    db.add_all(evaluations)
    db.commit()
    print(f"✅ Created {len(evaluations)} evaluations")
    db.close()


def seed_portfolios():
    db = SessionLocal()
    existing = db.query(Portfolio).first()
    if existing:
        print("⚠️  Portfolios already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding portfolios...")
    p1 = Portfolio(
        id="ptf001", student_id="s1",
        title="햄릿 독백 연습 영상",
        description="'To be or not to be' 독백을 한국어로 번안하여 연습한 영상입니다.",
        video_url="https://example.com/video/hamlet-mono",
        category=PortfolioCategory.MONOLOGUE,
        tags="독백,셰익스피어,햄릿,감정연기",
    )
    p2 = Portfolio(
        id="ptf002", student_id="s1",
        title="즉흥 연기 - 카페 장면",
        description="카페에서 오랜 친구를 만나는 즉흥 연기입니다.",
        video_url="https://example.com/video/improv-cafe",
        category=PortfolioCategory.IMPROV,
        tags="즉흥연기,감정전환",
    )
    db.add_all([p1, p2])
    db.commit()

    comments = [
        PortfolioComment(id="pcmt001", portfolio_id="ptf001", author_id="t1",
                         content="감정선의 흐름이 자연스럽습니다."),
        PortfolioComment(id="pcmt002", portfolio_id="ptf001", author_id="s2",
                         content="멋있다! 나도 이렇게 해보고 싶어요."),
    ]
    db.add_all(comments)
    db.commit()
    print("✅ Created 2 portfolios with comments")
    db.close()


def seed_auditions():
    db = SessionLocal()
    existing = db.query(Audition).first()
    if existing:
        print("⚠️  Auditions already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding auditions...")
    a1 = Audition(
        id="aud001", title="한예종 연극원 실기 시험",
        description="한국예술종합학교 연극원 입학 실기 시험입니다.",
        date=datetime.utcnow() + timedelta(days=30),
        location="한예종 석관동 캠퍼스",
        audition_type=AuditionType.AUDITION,
        status=AuditionStatus.UPCOMING,
        creator_id="s1", class_id="c1",
    )
    db.add(a1)
    db.commit()

    checklists = [
        AuditionChecklist(id="achk001", audition_id="aud001", content="자유 독백 대본 선정", is_checked=True, sort_order=1),
        AuditionChecklist(id="achk002", audition_id="aud001", content="자유 독백 3분 이내 편집", is_checked=True, sort_order=2),
        AuditionChecklist(id="achk003", audition_id="aud001", content="지정 대본 암기 완료", is_checked=False, sort_order=3),
        AuditionChecklist(id="achk004", audition_id="aud001", content="리허설 영상 촬영 및 피드백", is_checked=False, sort_order=4),
        AuditionChecklist(id="achk005", audition_id="aud001", content="의상 및 소품 준비", is_checked=False, sort_order=5),
    ]
    db.add_all(checklists)
    db.commit()
    print("✅ Created 1 audition with 5 checklist items")
    db.close()


def seed_private_lesson_requests():
    db = SessionLocal()
    existing = db.query(PrivateLessonRequest).first()
    if existing:
        print("⚠️  Private lesson requests already exist. Skipping seed.")
        db.close()
        return
    print("🌱 Seeding private lesson requests...")
    from datetime import date
    today = date.today()
    requests = [
        PrivateLessonRequest(
            id="plr001", student_id="s1", teacher_id="t1",
            subject=Subject.ACTING,
            preferred_date=(today + timedelta(days=3)).isoformat(),
            preferred_start_time="10:00", preferred_end_time="11:00",
            reason="입시 독백 개인 피드백을 받고 싶습니다.",
            status=RequestStatus.PENDING,
        ),
        PrivateLessonRequest(
            id="plr002", student_id="s2", teacher_id="t2",
            subject=Subject.DANCE,
            preferred_date=(today + timedelta(days=5)).isoformat(),
            preferred_start_time="14:00", preferred_end_time="15:00",
            reason="무용 기초 동작을 개인적으로 연습하고 싶습니다.",
            status=RequestStatus.APPROVED,
            response_note="좋습니다! 연습실 C에서 만나요.",
            responded_at=datetime.utcnow(),
        ),
    ]
    db.add_all(requests)
    db.commit()
    print(f"✅ Created {len(requests)} private lesson requests")
    db.close()


if __name__ == "__main__":
    print("🚀 SOL-ACT Database Seeder")
    print("=" * 50)

    print("\n📊 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully!")

    seed_users()
    seed_classes()
    seed_assignments()
    seed_diet_logs()
    seed_notices()
    seed_notifications()
    seed_chat_messages()
    seed_qna()
    seed_lessons()
    seed_attendance()
    seed_journals()
    seed_evaluations()
    seed_portfolios()
    seed_auditions()
    seed_private_lesson_requests()

    print("\n✨ Seeding complete!")
