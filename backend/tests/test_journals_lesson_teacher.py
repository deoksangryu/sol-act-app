"""회귀 테스트: 반 subject_teachers에는 없지만 lesson.teacher_id로 지정된 담당교사가
수업일지를 작성/조회/수정할 수 있어야 한다(수업 목록/상세는 이미 teacher_id를 인정하므로 일치시킴).

버그: 조용진 강사가 실제 담당(lesson.teacher_id)인 수업의 일지를 저장하면
'Not a member of this lesson's class' 403이 나던 문제. 반 과목담당(subject_teachers)은
다른 교사(김세희)로 잡혀 있었기 때문. 아래 t2가 그 상황을 재현한다.
"""
from datetime import date

from app.models.user import User, UserRole
from app.models.class_info import ClassInfo
from app.models.lesson import Lesson, LessonStatus, LessonType, Subject
from app.utils.auth import get_password_hash, create_access_token


def _hdr(uid):
    return {"Authorization": f"Bearer {create_access_token(data={'sub': uid})}"}


def _setup(db):
    """반 subject_teachers={acting:t1}, 그러나 수업 teacher_id=t2(지정 담당). t3=무관 교사."""
    db.add_all([
        User(id="t2", name="조교사", email="t2@muse.com",
             hashed_password=get_password_hash("password123"), role=UserRole.TEACHER),
        User(id="t3", name="남교사", email="t3@muse.com",
             hashed_password=get_password_hash("password123"), role=UserRole.TEACHER),
    ])
    cls = ClassInfo(id="cX", name="매체연기 중급반", description="중급", subject_teachers={"acting": "t1"}, schedule=[])
    db.add(cls)
    db.commit()
    lesson = Lesson(
        id="lsnX", class_id="cX", date=date.today(), start_time="18:00", end_time="20:00",
        status=LessonStatus.SCHEDULED, lesson_type=LessonType.REGULAR,
        subject=Subject.ACTING, teacher_id="t2", location="스튜디오",
    )
    db.add(lesson)
    db.commit()


def _create_body():
    return {"lesson_id": "lsnX", "journal_type": "teacher", "content": "오늘 카메라 연기 지도. 시선 처리 개선."}


def test_lesson_teacher_can_create_journal(client, seed_users, db):
    """지정 담당교사(t2)는 반 subject_teachers에 없어도 일지 작성 가능(회귀: 이전엔 403)."""
    _setup(db)
    res = client.post("/api/journals/", json=_create_body(), headers=_hdr("t2"))
    assert res.status_code == 201, res.text
    assert res.json()["journal_type"] == "teacher"


def test_lesson_teacher_can_list_and_get_journal(client, seed_users, db):
    """작성 후 목록/상세에서도 보여야 함(list_journals·get_journal 스코프도 함께 수정됨)."""
    _setup(db)
    created = client.post("/api/journals/", json=_create_body(), headers=_hdr("t2"))
    jid = created.json()["id"]

    lst = client.get("/api/journals/?lesson_id=lsnX", headers=_hdr("t2"))
    assert lst.status_code == 200
    assert any(j["id"] == jid for j in lst.json()), "지정 담당교사가 자기 일지를 목록에서 못 봄"

    got = client.get(f"/api/journals/{jid}", headers=_hdr("t2"))
    assert got.status_code == 200
    assert got.json()["id"] == jid


def test_lesson_teacher_can_update_own_lesson_journal(client, seed_users, db):
    _setup(db)
    jid = client.post("/api/journals/", json=_create_body(), headers=_hdr("t2")).json()["id"]
    res = client.put(f"/api/journals/{jid}", json={"content": "수정: 다음 시간 클로즈업 연습"}, headers=_hdr("t2"))
    assert res.status_code == 200
    assert res.json()["content"] == "수정: 다음 시간 클로즈업 연습"


def test_unrelated_teacher_still_forbidden(client, seed_users, db):
    """과잉완화 방지: 반에도 없고 lesson.teacher_id도 아닌 t3는 여전히 차단."""
    _setup(db)
    res = client.post("/api/journals/", json=_create_body(), headers=_hdr("t3"))
    assert res.status_code == 403, "무관한 교사가 일지를 쓸 수 있으면 안 됨"

    # t2가 만든 일지를 t3가 열람/수정도 불가해야 함
    jid = client.post("/api/journals/", json=_create_body(), headers=_hdr("t2")).json()["id"]
    assert client.get(f"/api/journals/{jid}", headers=_hdr("t3")).status_code == 403
    assert client.put(f"/api/journals/{jid}", json={"content": "x"}, headers=_hdr("t3")).status_code == 403
