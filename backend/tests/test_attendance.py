"""Tests for /api/attendance endpoints."""
import pytest


ATTENDANCE_BODY = {
    "lesson_id": "lsn001",
    "student_id": "s1",
    "status": "present",
    "note": "정상 출석",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_attendance(client, headers, body=None):
    """Create a single attendance record and return the response."""
    return client.post(
        "/api/attendance/",
        json=body or ATTENDANCE_BODY,
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_attendance(client, seed_lesson, teacher_headers):
    res = _create_attendance(client, teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["lesson_id"] == "lsn001"
    assert data["student_id"] == "s1"
    assert data["status"] == "present"
    assert data["marked_by"] == "t1"


def test_create_attendance_forbidden(client, seed_lesson, student_headers):
    res = _create_attendance(client, student_headers)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_attendance(client, seed_lesson, teacher_headers):
    _create_attendance(client, teacher_headers)

    res = client.get("/api/attendance/", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_lesson(client, seed_lesson, teacher_headers):
    _create_attendance(client, teacher_headers)

    res = client.get("/api/attendance/?lesson_id=lsn001", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert all(a["lesson_id"] == "lsn001" for a in data)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_attendance(client, seed_lesson, teacher_headers):
    create_res = _create_attendance(client, teacher_headers)
    att_id = create_res.json()["id"]

    body = {"status": "late", "note": "10분 지각"}
    res = client.put(f"/api/attendance/{att_id}", json=body, headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "late"
    assert data["note"] == "10분 지각"


# ---------------------------------------------------------------------------
# Bulk create
# ---------------------------------------------------------------------------

def test_bulk_create(client, seed_lesson, teacher_headers):
    body = {
        "lesson_id": "lsn001",
        "records": [
            {"student_id": "s1", "status": "present", "note": "출석"},
            {"student_id": "s2", "status": "late", "note": "5분 지각"},
        ],
    }
    res = client.post("/api/attendance/bulk", json=body, headers=teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 2
    statuses = {d["student_id"]: d["status"] for d in data}
    assert statuses["s1"] == "present"
    assert statuses["s2"] == "late"


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def test_attendance_stats(client, seed_lesson, teacher_headers):
    # Create attendance records for s1
    _create_attendance(client, teacher_headers, {
        "lesson_id": "lsn001",
        "student_id": "s1",
        "status": "present",
    })

    res = client.get("/api/attendance/stats?student_id=s1", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    stat = data[0]
    assert stat["student_id"] == "s1"
    assert stat["student_name"] == "김배우"
    assert stat["total"] >= 1
    assert stat["present"] >= 1
    assert "rate" in stat


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------

def test_response_has_student_name(client, seed_lesson, teacher_headers):
    create_res = _create_attendance(client, teacher_headers)
    assert create_res.status_code == 201
    data = create_res.json()
    assert "student_name" in data
    assert data["student_name"] == "김배우"
