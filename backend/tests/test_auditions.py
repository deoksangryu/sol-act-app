"""Tests for the auditions router (/api/auditions)."""
import pytest
from app.models.audition import Audition, AuditionChecklist


BASE = "/api/auditions"

CREATE_BODY = {
    "title": "2025 대학로 오디션",
    "description": "연극 오디션",
    "date": "2025-06-15T10:00:00",
    "location": "대학로 극장",
    "audition_type": "audition",
}


# ── helpers ──────────────────────────────────────────────────────────
def _create_audition(client, student_headers, body=None):
    """POST helper that returns the response object."""
    return client.post(BASE, json=body or CREATE_BODY, headers=student_headers)


# ── CREATE ───────────────────────────────────────────────────────────
def test_create_audition(client, student_headers, db):
    res = _create_audition(client, student_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == CREATE_BODY["title"]
    assert data["creator_id"] == "s1"
    assert data["checklists"] == []

    # verify persisted in DB
    row = db.query(Audition).filter(Audition.id == data["id"]).first()
    assert row is not None
    assert row.title == CREATE_BODY["title"]


# ── LIST / FILTER ────────────────────────────────────────────────────
def test_list_auditions(client, student_headers, teacher_headers, db):
    _create_audition(client, student_headers)
    res = client.get(BASE, headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_status(client, student_headers, teacher_headers, db):
    _create_audition(client, student_headers)
    res = client.get(BASE, params={"status": "upcoming"}, headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    for item in data:
        assert item["status"] == "upcoming"


# ── GET single ───────────────────────────────────────────────────────
def test_get_audition(client, student_headers, teacher_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    res = client.get(f"{BASE}/{aid}", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == aid
    assert "creator_name" in data
    assert data["creator_name"] == "김배우"


# ── UPDATE ───────────────────────────────────────────────────────────
def test_update_audition(client, student_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{aid}",
        json={"title": "수정된 오디션 제목"},
        headers=student_headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "수정된 오디션 제목"


def test_update_forbidden(client, student_headers, student2_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    # s2 is a different student, not teacher → 403
    res = client.put(
        f"{BASE}/{aid}",
        json={"title": "남의 오디션 수정 시도"},
        headers=student2_headers,
    )
    assert res.status_code == 403


# ── CHECKLISTS ───────────────────────────────────────────────────────
def test_add_checklist(client, student_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    res = client.post(
        f"{BASE}/{aid}/checklists",
        json={"content": "이력서 준비", "sort_order": 1},
        headers=student_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["content"] == "이력서 준비"
    assert data["is_checked"] is False
    assert data["sort_order"] == 1


def test_update_checklist(client, student_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    checklist_res = client.post(
        f"{BASE}/{aid}/checklists",
        json={"content": "프로필 사진 촬영", "sort_order": 1},
        headers=student_headers,
    )
    cid = checklist_res.json()["id"]

    res = client.put(
        f"{BASE}/{aid}/checklists/{cid}",
        json={"is_checked": True},
        headers=student_headers,
    )
    assert res.status_code == 200
    assert res.json()["is_checked"] is True


def test_delete_checklist(client, student_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    checklist_res = client.post(
        f"{BASE}/{aid}/checklists",
        json={"content": "삭제할 항목", "sort_order": 1},
        headers=student_headers,
    )
    cid = checklist_res.json()["id"]

    res = client.delete(f"{BASE}/{aid}/checklists/{cid}", headers=student_headers)
    assert res.status_code == 200

    # verify deleted from DB
    row = db.query(AuditionChecklist).filter(AuditionChecklist.id == cid).first()
    assert row is None


# ── DELETE ───────────────────────────────────────────────────────────
def test_delete_audition(client, student_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    # add a checklist first to verify cascade deletion
    client.post(
        f"{BASE}/{aid}/checklists",
        json={"content": "곧 삭제될 항목", "sort_order": 1},
        headers=student_headers,
    )

    res = client.delete(f"{BASE}/{aid}", headers=student_headers)
    assert res.status_code == 200

    # audition gone
    assert db.query(Audition).filter(Audition.id == aid).first() is None
    # checklists cascade-deleted
    assert (
        db.query(AuditionChecklist)
        .filter(AuditionChecklist.audition_id == aid)
        .first()
        is None
    )


# ── CHECKLIST FIELD NAMES (CRITICAL) ─────────────────────────────────
def test_checklist_field_names(client, student_headers, teacher_headers, db):
    """Verify the response uses 'checklists' (plural) and items have
    'content' and 'is_checked' -- NOT 'checklist', 'text', or 'completed'."""
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    client.post(
        f"{BASE}/{aid}/checklists",
        json={"content": "필드명 검증 항목", "sort_order": 0},
        headers=student_headers,
    )

    res = client.get(f"{BASE}/{aid}", headers=teacher_headers)
    assert res.status_code == 200
    data = res.json()

    # Top-level key must be "checklists" (plural)
    assert "checklists" in data
    assert "checklist" not in data

    assert len(data["checklists"]) >= 1
    item = data["checklists"][0]

    # Each item must have "content" and "is_checked"
    assert "content" in item
    assert "is_checked" in item

    # Must NOT use wrong field names
    assert "text" not in item
    assert "completed" not in item


# ── AI GENERATE TIPS ─────────────────────────────────────────────────
def test_generate_tips(client, student_headers, db):
    create_res = _create_audition(client, student_headers)
    aid = create_res.json()["id"]

    res = client.post(f"{BASE}/{aid}/generate-tips", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert "tips" in data
    assert data["tips"] == "오디션 팁입니다."
