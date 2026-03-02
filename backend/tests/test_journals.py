"""Tests for /api/journals endpoints."""
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_teacher_journal(client, headers):
    """Create a teacher journal and return the response dict."""
    body = {
        "lesson_id": "lsn001",
        "journal_type": "teacher",
        "content": "오늘 수업에서 감정 표현 훈련을 진행했습니다.",
        "objectives": "감정 표현력 향상",
        "next_plan": "다음 수업에서 독백 연습 진행",
    }
    res = client.post("/api/journals/", json=body, headers=headers)
    return res


def _create_student_journal(client, headers):
    """Create a student journal and return the response dict."""
    body = {
        "lesson_id": "lsn001",
        "journal_type": "student",
        "content": "감정 표현이 어려웠지만 많이 배웠습니다.",
    }
    res = client.post("/api/journals/", json=body, headers=headers)
    return res


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_teacher_journal(client, seed_lesson, teacher_headers):
    res = _create_teacher_journal(client, teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["journal_type"] == "teacher"
    assert data["content"] == "오늘 수업에서 감정 표현 훈련을 진행했습니다."
    assert data["objectives"] == "감정 표현력 향상"
    assert data["next_plan"] == "다음 수업에서 독백 연습 진행"
    assert data["author_id"] == "t1"


def test_create_student_journal(client, seed_lesson, student_headers):
    res = _create_student_journal(client, student_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["journal_type"] == "student"
    assert data["content"] == "감정 표현이 어려웠지만 많이 배웠습니다."
    assert data["author_id"] == "s1"


# ---------------------------------------------------------------------------
# List / Get
# ---------------------------------------------------------------------------

def test_list_journals(client, seed_lesson, teacher_headers, student_headers):
    _create_teacher_journal(client, teacher_headers)
    _create_student_journal(client, student_headers)

    res = client.get("/api/journals/", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_list_filter_by_lesson(client, seed_lesson, teacher_headers):
    _create_teacher_journal(client, teacher_headers)

    res = client.get("/api/journals/?lesson_id=lsn001", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert all(j["lesson_id"] == "lsn001" for j in data)


def test_get_journal(client, seed_lesson, teacher_headers):
    create_res = _create_teacher_journal(client, teacher_headers)
    journal_id = create_res.json()["id"]

    res = client.get(f"/api/journals/{journal_id}", headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["id"] == journal_id


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_journal_by_author(client, seed_lesson, student_headers):
    create_res = _create_student_journal(client, student_headers)
    journal_id = create_res.json()["id"]

    body = {"content": "수정된 일지 내용입니다."}
    res = client.put(f"/api/journals/{journal_id}", json=body, headers=student_headers)
    assert res.status_code == 200
    assert res.json()["content"] == "수정된 일지 내용입니다."


def test_update_journal_forbidden(client, seed_lesson, student_headers, student2_headers):
    # s1 creates the journal
    create_res = _create_student_journal(client, student_headers)
    journal_id = create_res.json()["id"]

    # s2 (another student) tries to update it -> 403
    body = {"content": "해킹 시도"}
    res = client.put(f"/api/journals/{journal_id}", json=body, headers=student2_headers)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_journal(client, seed_lesson, teacher_headers):
    create_res = _create_teacher_journal(client, teacher_headers)
    journal_id = create_res.json()["id"]

    res = client.delete(f"/api/journals/{journal_id}", headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Journal deleted"

    # Confirm gone
    res2 = client.get(f"/api/journals/{journal_id}", headers=teacher_headers)
    assert res2.status_code == 404


# ---------------------------------------------------------------------------
# AI feedback
# ---------------------------------------------------------------------------

def test_ai_feedback_endpoint(client, seed_lesson, teacher_headers):
    create_res = _create_teacher_journal(client, teacher_headers)
    journal_id = create_res.json()["id"]

    res = client.post(f"/api/journals/{journal_id}/ai-feedback", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "ai_feedback" in data
    assert data["ai_feedback"] == "피드백입니다."
