"""Tests for the diet router (/api/diet)."""
import pytest
from app.models.diet import DietLog


BASE = "/api/diet"

CREATE_BODY = {
    "student_id": "s1",
    "date": "2025-06-15T08:30:00",
    "meal_type": "breakfast",
    "description": "통밀빵 토스트",
}


# ── helpers ──────────────────────────────────────────────────────────
def _create_diet_log(client, body=None, headers=None):
    return client.post(BASE, json=body or CREATE_BODY, headers=headers)


# ── CREATE ───────────────────────────────────────────────────────────
def test_create_diet_log(client, student_headers, db):
    res = _create_diet_log(client, headers=student_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["student_id"] == "s1"
    assert data["student_name"] == "김배우"
    assert data["meal_type"] == "breakfast"
    assert data["description"] == "통밀빵 토스트"

    # verify persisted in DB
    row = db.query(DietLog).filter(DietLog.id == data["id"]).first()
    assert row is not None
    assert row.description == "통밀빵 토스트"


def test_create_invalid_student(client, teacher_headers):
    # Use teacher so we bypass the "student can only create own" check
    # and actually reach the 404 for a non-existent student.
    body = {**CREATE_BODY, "student_id": "xxx"}
    res = _create_diet_log(client, body, headers=teacher_headers)
    assert res.status_code == 404


# ── LIST / FILTER ────────────────────────────────────────────────────
def test_list_diet_logs(client, student_headers):
    # create two logs as student s1
    _create_diet_log(client, headers=student_headers)
    _create_diet_log(
        client,
        {**CREATE_BODY, "meal_type": "lunch", "description": "비빔밥"},
        headers=student_headers,
    )

    # student s1 lists their own logs (server forces filter)
    res = client.get(BASE, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_list_filter_by_student(client, teacher_headers):
    # Use teacher to create logs for both s1 and s2
    _create_diet_log(client, headers=teacher_headers)
    _create_diet_log(
        client,
        {**CREATE_BODY, "student_id": "s2"},
        headers=teacher_headers,
    )

    # Teacher can filter by student_id
    res = client.get(BASE, params={"student_id": "s1"}, headers=teacher_headers)
    assert res.status_code == 200
    for item in res.json():
        assert item["student_id"] == "s1"


def test_list_filter_by_date(client, student_headers):
    _create_diet_log(client, headers=student_headers)

    res = client.get(BASE, params={"date": "2025-06-15"}, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1


# ── UPDATE ───────────────────────────────────────────────────────────
def test_update_diet_log(client, student_headers):
    create_res = _create_diet_log(client, headers=student_headers)
    diet_id = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{diet_id}",
        json={"description": "수정된 식단", "calories": 350},
        headers=student_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["description"] == "수정된 식단"
    assert data["calories"] == 350


# ── DELETE ───────────────────────────────────────────────────────────
def test_delete_diet_log(client, student_headers, db):
    create_res = _create_diet_log(client, headers=student_headers)
    diet_id = create_res.json()["id"]

    res = client.delete(f"{BASE}/{diet_id}", headers=student_headers)
    assert res.status_code == 200

    row = db.query(DietLog).filter(DietLog.id == diet_id).first()
    assert row is None


# ── ANALYZE ──────────────────────────────────────────────────────────
def test_analyze_diet(client, student_headers):
    res = client.post(
        f"{BASE}/analyze",
        json={"description": "통밀빵 토스트와 우유"},
        headers=student_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "calories" in data
    # mock returns "advice" key
    assert "advice" in data or "ai_advice" in data


# ── RESPONSE FORMAT ──────────────────────────────────────────────────
def test_response_format(client, student_headers):
    create_res = _create_diet_log(client, headers=student_headers)
    assert create_res.status_code == 201
    data = create_res.json()

    # verify all expected fields are present
    assert "meal_type" in data
    assert "ai_advice" in data  # nullable but key must exist
    assert "image_url" in data  # nullable but key must exist
    assert "created_at" in data
    assert "student_name" in data
