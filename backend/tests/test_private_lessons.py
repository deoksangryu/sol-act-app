"""Tests for the private-lessons router (/api/private-lessons)."""
import pytest
from app.models.private_lesson import PrivateLessonRequest
from app.models.lesson import Lesson


BASE = "/api/private-lessons"

CREATE_BODY = {
    "teacher_id": "t1",
    "subject": "acting",
    "preferred_date": "2025-06-20",
    "preferred_start_time": "10:00",
    "preferred_end_time": "11:00",
    "reason": "개인 피드백 요청",
}


# ── helpers ──────────────────────────────────────────────────────────
def _create_request(client, student_headers, body=None):
    """POST helper that returns the response object."""
    return client.post(BASE, json=body or CREATE_BODY, headers=student_headers)


# ── CREATE ───────────────────────────────────────────────────────────
def test_create_request(client, student_headers, db):
    res = _create_request(client, student_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["student_id"] == "s1"
    assert data["teacher_id"] == "t1"
    assert data["status"] == "pending"

    # verify persisted in DB
    row = (
        db.query(PrivateLessonRequest)
        .filter(PrivateLessonRequest.id == data["id"])
        .first()
    )
    assert row is not None
    assert row.reason == CREATE_BODY["reason"]


# ── LIST / FILTER ────────────────────────────────────────────────────
def test_list_requests(client, student_headers, db):
    _create_request(client, student_headers)
    res = client.get(BASE, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_student(client, student_headers, db):
    _create_request(client, student_headers)
    res = client.get(BASE, params={"student_id": "s1"}, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    for item in data:
        assert item["student_id"] == "s1"


# ── RESPOND (approve / reject) ──────────────────────────────────────
def test_respond_approve(client, student_headers, teacher_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{rid}/respond",
        json={"status": "approved", "response_note": "승인합니다"},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"
    assert data["response_note"] == "승인합니다"
    assert data["responded_at"] is not None


def test_respond_reject(client, student_headers, teacher_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{rid}/respond",
        json={"status": "rejected", "response_note": "일정이 맞지 않습니다"},
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "rejected"

    # no lesson should be created for a rejection
    lesson = db.query(Lesson).filter(Lesson.request_id == rid).first()
    assert lesson is None


def test_respond_forbidden(client, student_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    # student tries to respond → 403
    res = client.put(
        f"{BASE}/{rid}/respond",
        json={"status": "approved", "response_note": "학생이 승인 시도"},
        headers=student_headers,
    )
    assert res.status_code == 403


# ── AUTO-CREATED LESSON ──────────────────────────────────────────────
def test_auto_created_lesson(client, student_headers, teacher_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    client.put(
        f"{BASE}/{rid}/respond",
        json={"status": "approved", "response_note": "승인"},
        headers=teacher_headers,
    )

    lesson = db.query(Lesson).filter(Lesson.request_id == rid).first()
    assert lesson is not None
    assert lesson.is_private is True
    assert lesson.teacher_id == "t1"
    assert lesson.start_time == "10:00"
    assert lesson.end_time == "11:00"


# ── DELETE ───────────────────────────────────────────────────────────
def test_delete_by_owner(client, student_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    res = client.delete(f"{BASE}/{rid}", headers=student_headers)
    assert res.status_code == 200

    row = (
        db.query(PrivateLessonRequest)
        .filter(PrivateLessonRequest.id == rid)
        .first()
    )
    assert row is None


def test_delete_forbidden(client, student_headers, student2_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    # s2 tries to delete s1's request → 403
    res = client.delete(f"{BASE}/{rid}", headers=student2_headers)
    assert res.status_code == 403


# ── RESPONSE FORMAT ──────────────────────────────────────────────────
def test_response_has_student_teacher_names(client, student_headers, db):
    create_res = _create_request(client, student_headers)
    rid = create_res.json()["id"]

    res = client.get(BASE, headers=student_headers)
    assert res.status_code == 200
    data = res.json()

    # find the request we just created
    item = next(r for r in data if r["id"] == rid)
    assert "student_name" in item
    assert item["student_name"] == "김배우"
    assert "teacher_name" in item
    assert item["teacher_name"] == "박선생"
