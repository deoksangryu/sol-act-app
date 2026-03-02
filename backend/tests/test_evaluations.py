"""Tests for the evaluations router (/api/evaluations)."""
import pytest
from app.models.evaluation import Evaluation


BASE = "/api/evaluations"

CREATE_BODY = {
    "student_id": "s1",
    "class_id": "c1",
    "subject": "acting",
    "period": "2025-1학기",
    "scores": {
        "acting": 5,
        "expression": 4,
        "creativity": 4,
        "teamwork": 5,
        "effort": 5,
    },
    "comment": "잘했습니다",
}


# ── helpers ──────────────────────────────────────────────────────────
def _create_evaluation(client, teacher_headers, body=None):
    return client.post(BASE, json=body or CREATE_BODY, headers=teacher_headers)


# ── CREATE ───────────────────────────────────────────────────────────
def test_create_evaluation_teacher(client, seed_class, teacher_headers, db):
    res = _create_evaluation(client, teacher_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["student_id"] == "s1"
    assert data["student_name"] == "김배우"
    assert data["scores"]["acting"] == 5

    # verify persisted in DB
    row = db.query(Evaluation).filter(Evaluation.id == data["id"]).first()
    assert row is not None
    assert row.acting_skill == 5


def test_create_evaluation_forbidden(client, seed_class, student_headers):
    res = _create_evaluation(client, student_headers)
    assert res.status_code == 403


# ── LIST / FILTER ────────────────────────────────────────────────────
def test_list_evaluations(client, seed_class, teacher_headers):
    _create_evaluation(client, teacher_headers)

    res = client.get(BASE)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_student(client, seed_class, teacher_headers):
    _create_evaluation(client, teacher_headers)

    res = client.get(BASE, params={"student_id": "s1"})
    assert res.status_code == 200
    for item in res.json():
        assert item["student_id"] == "s1"


# ── GET single ───────────────────────────────────────────────────────
def test_get_evaluation(client, seed_class, teacher_headers):
    create_res = _create_evaluation(client, teacher_headers)
    eval_id = create_res.json()["id"]

    res = client.get(f"{BASE}/{eval_id}")
    assert res.status_code == 200
    data = res.json()
    scores = data["scores"]
    assert scores["acting"] == 5
    assert scores["expression"] == 4
    assert scores["creativity"] == 4
    assert scores["teamwork"] == 5
    assert scores["effort"] == 5


# ── UPDATE ───────────────────────────────────────────────────────────
def test_update_evaluation(client, seed_class, teacher_headers):
    create_res = _create_evaluation(client, teacher_headers)
    eval_id = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{eval_id}",
        json={
            "comment": "수정된 평가",
            "scores": {"acting": 3, "expression": 3, "creativity": 3, "teamwork": 3, "effort": 3},
        },
        headers=teacher_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["comment"] == "수정된 평가"
    assert data["scores"]["acting"] == 3


# ── DELETE ───────────────────────────────────────────────────────────
def test_delete_evaluation(client, seed_class, teacher_headers, db):
    create_res = _create_evaluation(client, teacher_headers)
    eval_id = create_res.json()["id"]

    res = client.delete(f"{BASE}/{eval_id}", headers=teacher_headers)
    assert res.status_code == 200

    row = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    assert row is None


# ── STUDENT REPORT ───────────────────────────────────────────────────
def test_student_report(client, seed_class, teacher_headers):
    _create_evaluation(client, teacher_headers)

    res = client.get(f"{BASE}/report/s1")
    assert res.status_code == 200
    data = res.json()
    assert data["student_id"] == "s1"
    assert data["student_name"] == "김배우"
    assert isinstance(data["evaluations"], list)
    assert len(data["evaluations"]) >= 1
    assert "ai_report" in data


# ── DB COLUMN VERIFICATION ──────────────────────────────────────────
def test_scores_db_columns(client, seed_class, teacher_headers, db):
    create_res = _create_evaluation(client, teacher_headers)
    eval_id = create_res.json()["id"]

    row = db.query(Evaluation).filter(Evaluation.id == eval_id).first()
    assert row.acting_skill == 5
    assert row.expressiveness == 4
    assert row.creativity == 4
    assert row.teamwork == 5
    assert row.effort == 5


# ── AI SUMMARY ───────────────────────────────────────────────────────
def test_ai_summary_endpoint(client, seed_class, teacher_headers):
    create_res = _create_evaluation(client, teacher_headers)
    eval_id = create_res.json()["id"]

    res = client.post(f"{BASE}/{eval_id}/ai-summary", headers=teacher_headers)
    assert res.status_code == 200
    assert "ai_summary" in res.json()
