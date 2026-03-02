"""Tests for /api/lessons endpoints."""
import pytest
from datetime import date


LESSON_BODY = {
    "class_id": "c1",
    "date": "2025-06-15",
    "start_time": "10:00",
    "end_time": "12:00",
    "lesson_type": "regular",
    "subject": "acting",
    "teacher_id": "t1",
    "location": "연습실 B",
}


# ---------------------------------------------------------------------------
# List / Get
# ---------------------------------------------------------------------------

def test_list_lessons(client, seed_lesson, teacher_headers):
    res = client.get("/api/lessons/", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_date(client, seed_lesson, teacher_headers):
    today = date.today().isoformat()
    res = client.get(
        f"/api/lessons/?date_from={today}&date_to={today}",
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert all(d["date"] == today for d in data)


def test_get_lesson(client, seed_lesson, teacher_headers):
    res = client.get("/api/lessons/lsn001", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "lsn001"
    assert data["class_id"] == "c1"


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_lesson(client, seed_class, teacher_headers):
    res = client.post("/api/lessons/", json=LESSON_BODY, headers=teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["class_id"] == "c1"
    assert data["subject"] == "acting"
    assert data["location"] == "연습실 B"
    assert data["date"] == "2025-06-15"


def test_create_lesson_forbidden(client, seed_class, student_headers):
    res = client.post("/api/lessons/", json=LESSON_BODY, headers=student_headers)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Update / Status changes / Delete
# ---------------------------------------------------------------------------

def test_update_lesson(client, seed_lesson, teacher_headers):
    body = {"location": "대극장", "memo": "장소 변경"}
    res = client.put("/api/lessons/lsn001", json=body, headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["location"] == "대극장"
    assert data["memo"] == "장소 변경"


def test_cancel_lesson(client, seed_lesson, teacher_headers):
    res = client.put("/api/lessons/lsn001/cancel", headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


def test_complete_lesson(client, seed_lesson, teacher_headers):
    res = client.put("/api/lessons/lsn001/complete", headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "completed"


def test_delete_lesson(client, seed_lesson, teacher_headers):
    res = client.delete("/api/lessons/lsn001", headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Lesson deleted"

    res2 = client.get("/api/lessons/lsn001", headers=teacher_headers)
    assert res2.status_code == 404


# ---------------------------------------------------------------------------
# Bulk create
# ---------------------------------------------------------------------------

def test_bulk_create_lessons(client, seed_class, teacher_headers):
    # 2025-06-16 (Mon=0) to 2025-06-22 (Sun=6): weekdays [0,2] -> Mon 16, Wed 18
    body = {
        "class_id": "c1",
        "start_date": "2025-06-16",
        "end_date": "2025-06-22",
        "weekdays": [0, 2],
        "start_time": "14:00",
        "end_time": "16:00",
        "lesson_type": "regular",
        "subject": "acting",
        "teacher_id": "t1",
        "location": "연습실 C",
    }
    res = client.post("/api/lessons/bulk", json=body, headers=teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 2
    dates = sorted([d["date"] for d in data])
    assert dates == ["2025-06-16", "2025-06-18"]


# ---------------------------------------------------------------------------
# Response shape assertions
# ---------------------------------------------------------------------------

def test_response_has_class_name_teacher_name(client, seed_lesson, teacher_headers):
    res = client.get("/api/lessons/lsn001", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "class_name" in data
    assert data["class_name"] == "입시 A반"
    assert "teacher_name" in data
    assert data["teacher_name"] == "박선생"
