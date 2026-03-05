"""Tests for the assignments router (/api/assignments)."""
import pytest
from app.models.assignment import Assignment


BASE = "/api/assignments"

CREATE_BODY = {
    "title": "과제 제목",
    "description": "설명",
    "due_date": "2025-12-31T00:00:00",
    "student_id": "s1",
}


# ── helpers ──────────────────────────────────────────────────────────
def _create_assignment(client, teacher_headers, body=None):
    """POST helper that returns the response object."""
    return client.post(BASE, json=body or CREATE_BODY, headers=teacher_headers)


# ── CREATE ───────────────────────────────────────────────────────────
def test_create_assignment_teacher(client, teacher_headers, db):
    res = _create_assignment(client, teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == CREATE_BODY["title"]
    assert data["student_name"] == "김배우"

    # verify persisted in DB
    row = db.query(Assignment).filter(Assignment.id == data["id"]).first()
    assert row is not None
    assert row.title == CREATE_BODY["title"]


def test_create_assignment_student_forbidden(client, student_headers):
    res = _create_assignment(client, student_headers)
    assert res.status_code == 403


# ── LIST / FILTER ────────────────────────────────────────────────────
def test_list_assignments(client, seed_assignment, teacher_headers):
    res = client.get(BASE, headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_status(client, seed_assignment, teacher_headers):
    res = client.get(BASE, params={"status": "pending"}, headers=teacher_headers)
    assert res.status_code == 200
    for item in res.json():
        assert item["status"] == "pending"


def test_list_filter_by_student(client, seed_assignment, teacher_headers):
    res = client.get(BASE, params={"student_id": "s1"}, headers=teacher_headers)
    assert res.status_code == 200
    for item in res.json():
        assert item["student_id"] == "s1"


# ── GET single ───────────────────────────────────────────────────────
def test_get_assignment(client, seed_assignment, teacher_headers):
    res = client.get(f"{BASE}/asgn001", headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["id"] == "asgn001"


def test_get_assignment_not_found(client, seed_users, teacher_headers):
    res = client.get(f"{BASE}/nonexistent", headers=teacher_headers)
    assert res.status_code == 404


# ── SUBMIT ───────────────────────────────────────────────────────────
def test_submit_by_owner(client, seed_assignment, student_headers, db):
    res = client.put(
        f"{BASE}/asgn001/submit",
        json={"submission_text": "나의 독백 제출입니다"},
        headers=student_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "submitted"
    assert data["submission_text"] == "나의 독백 제출입니다"


def test_submit_forbidden(client, seed_assignment, student2_headers):
    res = client.put(
        f"{BASE}/asgn001/submit",
        json={"submission_text": "남의 과제 제출 시도"},
        headers=student2_headers,
    )
    assert res.status_code == 403


# ── GRADE ────────────────────────────────────────────────────────────
def test_grade_by_teacher(client, seed_assignment, teacher_headers, db):
    # first submit so the assignment is in 'submitted' state
    client.put(
        f"{BASE}/asgn001/submit",
        json={"submission_text": "독백 제출"},
        headers={"Authorization": f"Bearer {__import__('app.utils.auth', fromlist=['create_access_token']).create_access_token(data={'sub': 's1'})}"},
    )

    res = client.put(
        f"{BASE}/asgn001/grade",
        json={"grade": "A", "feedback": "훌륭합니다"},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "graded"
    assert data["grade"] == "A"
    assert data["feedback"] == "훌륭합니다"


def test_grade_forbidden(client, seed_assignment, student_headers):
    res = client.put(
        f"{BASE}/asgn001/grade",
        json={"grade": "B", "feedback": "..."},
        headers=student_headers,
    )
    assert res.status_code == 403


# ── UPDATE ───────────────────────────────────────────────────────────
def test_update_assignment(client, seed_assignment, teacher_headers):
    res = client.put(
        f"{BASE}/asgn001",
        json={"feedback": "수정된 피드백"},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    assert res.json()["feedback"] == "수정된 피드백"


# ── DELETE ───────────────────────────────────────────────────────────
def test_delete_assignment_teacher(client, seed_assignment, teacher_headers, db):
    res = client.delete(f"{BASE}/asgn001", headers=teacher_headers)
    assert res.status_code == 200

    row = db.query(Assignment).filter(Assignment.id == "asgn001").first()
    assert row is None


def test_delete_assignment_forbidden(client, seed_assignment, student_headers):
    res = client.delete(f"{BASE}/asgn001", headers=student_headers)
    assert res.status_code == 403


# ── FULL LIFECYCLE ───────────────────────────────────────────────────
def test_full_lifecycle(client, seed_users, teacher_headers, student_headers, db):
    # 1. teacher creates assignment
    res = _create_assignment(client, teacher_headers)
    assert res.status_code == 201
    aid = res.json()["id"]

    # 2. student submits
    res = client.put(
        f"{BASE}/{aid}/submit",
        json={"submission_text": "셰익스피어 독백 녹화 완료"},
        headers=student_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "submitted"

    # 3. teacher grades
    res = client.put(
        f"{BASE}/{aid}/grade",
        json={"grade": "A+", "feedback": "매우 훌륭한 연기"},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "graded"
    assert data["grade"] == "A+"


# ── ANALYZE ──────────────────────────────────────────────────────────
def test_analyze_endpoint(client, seed_assignment, student_headers, teacher_headers):
    # submit first so there is text to analyze
    client.put(
        f"{BASE}/asgn001/submit",
        json={"submission_text": "To be or not to be..."},
        headers=student_headers,
    )

    res = client.post(f"{BASE}/asgn001/analyze", headers=teacher_headers)
    assert res.status_code == 200
    assert "ai_analysis" in res.json()


# ── RESPONSE FORMAT ──────────────────────────────────────────────────
def test_response_has_student_name(client, seed_assignment, teacher_headers):
    res = client.get(f"{BASE}/asgn001", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "student_name" in data
    assert data["student_name"] == "김배우"
