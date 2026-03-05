"""Tests for /api/classes endpoints."""
import pytest


# ---------------------------------------------------------------------------
# List / Get
# ---------------------------------------------------------------------------

def test_list_classes(client, seed_class, teacher_headers):
    res = client.get("/api/classes/", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["id"] == "c1"


def test_get_class(client, seed_class, teacher_headers):
    res = client.get("/api/classes/c1", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "c1"
    assert data["name"] == "입시 A반"


def test_get_class_not_found(client, seed_users, teacher_headers):
    res = client.get("/api/classes/nonexistent", headers=teacher_headers)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Create — Director only
# ---------------------------------------------------------------------------

def test_create_class_director(client, db, director_headers):
    body = {
        "name": "뮤지컬 B반",
        "description": "기초반",
        "schedule": [{"day": "화", "start_time": "14:00", "end_time": "16:00"},
                     {"day": "목", "start_time": "14:00", "end_time": "16:00"}],
        "subject_teachers": {"musical": "t1"},
        "student_ids": ["s1"],
    }
    res = client.post("/api/classes/", json=body, headers=director_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "뮤지컬 B반"
    assert "s1" in data["student_ids"]
    assert isinstance(data["schedule"], list)
    assert data["schedule"][0]["day"] == "화"

    # Verify persisted in DB
    from app.models.class_info import ClassInfo
    cls = db.query(ClassInfo).filter(ClassInfo.id == data["id"]).first()
    assert cls is not None
    assert cls.name == "뮤지컬 B반"


def test_create_class_forbidden_student(client, student_headers):
    body = {
        "name": "불법 반",
        "description": "학생이 만듦",
        "schedule": [],
    }
    res = client.post("/api/classes/", json=body, headers=student_headers)
    assert res.status_code == 403


def test_create_class_forbidden_teacher(client, teacher_headers):
    """Teachers can no longer create classes — director only."""
    body = {
        "name": "선생님 반",
        "description": "선생님이 만듦",
        "schedule": [],
    }
    res = client.post("/api/classes/", json=body, headers=teacher_headers)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Update / Delete — Director only
# ---------------------------------------------------------------------------

def test_update_class(client, seed_class, director_headers):
    body = {"name": "입시 A반 (수정)", "description": "설명 변경"}
    res = client.put("/api/classes/c1", json=body, headers=director_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "입시 A반 (수정)"
    assert data["description"] == "설명 변경"


def test_update_class_forbidden_teacher(client, seed_class, teacher_headers):
    body = {"name": "변경 시도"}
    res = client.put("/api/classes/c1", json=body, headers=teacher_headers)
    assert res.status_code == 403


def test_delete_class(client, seed_class, director_headers):
    res = client.delete("/api/classes/c1", headers=director_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "Class deleted"

    # Confirm gone
    res2 = client.get("/api/classes/c1", headers=director_headers)
    assert res2.status_code == 404


def test_delete_class_forbidden_teacher(client, seed_class, teacher_headers):
    res = client.delete("/api/classes/c1", headers=teacher_headers)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Add / Remove students — Director only
# ---------------------------------------------------------------------------

def test_add_student(client, seed_class, director_headers):
    # Remove s2 first to re-add
    client.delete("/api/classes/c1/students/s2", headers=director_headers)

    res = client.post(
        "/api/classes/c1/students",
        json={"student_id": "s2"},
        headers=director_headers,
    )
    assert res.status_code == 200
    assert "s2" in res.json()["student_ids"]


def test_remove_student(client, seed_class, director_headers):
    res = client.delete("/api/classes/c1/students/s2", headers=director_headers)
    assert res.status_code == 200
    assert "s2" not in res.json()["student_ids"]


# ---------------------------------------------------------------------------
# Response shape assertions
# ---------------------------------------------------------------------------

def test_response_has_subject_teachers(client, seed_class, teacher_headers):
    res = client.get("/api/classes/c1", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "subject_teachers" in data
    assert isinstance(data["subject_teachers"], dict)
    assert data["subject_teachers"].get("acting") == "t1"


def test_response_has_student_ids(client, seed_class, teacher_headers):
    res = client.get("/api/classes/c1", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert "student_ids" in data
    assert isinstance(data["student_ids"], list)
    assert set(data["student_ids"]) == {"s1", "s2"}
