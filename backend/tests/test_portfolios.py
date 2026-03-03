"""Tests for the portfolios router (/api/portfolios)."""
import pytest
from app.models.portfolio import Portfolio, PortfolioComment


BASE = "/api/portfolios"

CREATE_BODY = {
    "title": "햄릿 독백",
    "description": "To be or not to be",
    "video_url": "https://example.com/video.mp4",
    "category": "monologue",
    "tags": "hamlet,shakespeare",
}


# ── helpers ──────────────────────────────────────────────────────────
def _create_portfolio(client, student_headers, body=None):
    """POST helper that returns the response object."""
    return client.post(BASE, json=body or CREATE_BODY, headers=student_headers)


# ── CREATE ───────────────────────────────────────────────────────────
def test_create_portfolio(client, student_headers, db):
    res = _create_portfolio(client, student_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == CREATE_BODY["title"]
    assert data["student_id"] == "s1"

    # verify persisted in DB
    row = db.query(Portfolio).filter(Portfolio.id == data["id"]).first()
    assert row is not None
    assert row.title == CREATE_BODY["title"]


# ── LIST / FILTER ────────────────────────────────────────────────────
def test_list_portfolios(client, student_headers, db):
    _create_portfolio(client, student_headers)
    res = client.get(BASE, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_filter_by_category(client, student_headers, db):
    _create_portfolio(client, student_headers)
    res = client.get(BASE, params={"category": "monologue"}, headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    for item in data:
        assert item["category"] == "monologue"


# ── GET single ───────────────────────────────────────────────────────
def test_get_portfolio(client, student_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    res = client.get(f"{BASE}/{pid}", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == pid
    assert "student_name" in data
    assert data["student_name"] == "김배우"
    assert "comments" in data
    assert isinstance(data["comments"], list)


# ── UPDATE ───────────────────────────────────────────────────────────
def test_update_portfolio_by_owner(client, student_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{pid}",
        json={"title": "수정된 제목"},
        headers=student_headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "수정된 제목"


def test_update_portfolio_forbidden(client, student_headers, student2_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    res = client.put(
        f"{BASE}/{pid}",
        json={"title": "남의 포트폴리오 수정 시도"},
        headers=student2_headers,
    )
    assert res.status_code == 403


# ── COMMENTS ─────────────────────────────────────────────────────────
def test_add_comment(client, student_headers, teacher_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    res = client.post(
        f"{BASE}/{pid}/comments",
        json={"content": "훌륭한 독백입니다!"},
        headers=teacher_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["content"] == "훌륭한 독백입니다!"
    assert data["author_id"] == "t1"
    assert "author_name" in data


def test_delete_comment_by_author(client, student_headers, teacher_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    comment_res = client.post(
        f"{BASE}/{pid}/comments",
        json={"content": "삭제할 댓글"},
        headers=teacher_headers,
    )
    cid = comment_res.json()["id"]

    res = client.delete(f"{BASE}/{pid}/comments/{cid}", headers=teacher_headers)
    assert res.status_code == 200

    # verify deleted from DB
    row = db.query(PortfolioComment).filter(PortfolioComment.id == cid).first()
    assert row is None


def test_delete_comment_forbidden(client, student_headers, student2_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    # s1 adds a comment
    comment_res = client.post(
        f"{BASE}/{pid}/comments",
        json={"content": "내 댓글"},
        headers=student_headers,
    )
    cid = comment_res.json()["id"]

    # s2 tries to delete it → 403
    res = client.delete(f"{BASE}/{pid}/comments/{cid}", headers=student2_headers)
    assert res.status_code == 403


# ── DELETE ───────────────────────────────────────────────────────────
def test_delete_portfolio(client, student_headers, teacher_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    # add a comment first to verify cascade deletion
    client.post(
        f"{BASE}/{pid}/comments",
        json={"content": "곧 삭제될 댓글"},
        headers=teacher_headers,
    )

    res = client.delete(f"{BASE}/{pid}", headers=student_headers)
    assert res.status_code == 200

    # portfolio gone
    assert db.query(Portfolio).filter(Portfolio.id == pid).first() is None
    # comments cascade-deleted
    assert (
        db.query(PortfolioComment)
        .filter(PortfolioComment.portfolio_id == pid)
        .first()
        is None
    )


# ── AI FEEDBACK ──────────────────────────────────────────────────────
def test_ai_feedback(client, student_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    res = client.post(f"{BASE}/{pid}/ai-feedback", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert "ai_feedback" in data
    assert data["ai_feedback"] == "포트폴리오 피드백입니다."


# ── RESPONSE FORMAT ──────────────────────────────────────────────────
def test_response_has_comments_array(client, student_headers, teacher_headers, db):
    create_res = _create_portfolio(client, student_headers)
    pid = create_res.json()["id"]

    # add a comment
    client.post(
        f"{BASE}/{pid}/comments",
        json={"content": "댓글 테스트"},
        headers=teacher_headers,
    )

    res = client.get(f"{BASE}/{pid}", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert "comments" in data
    assert isinstance(data["comments"], list)
    assert len(data["comments"]) == 1
    assert data["comments"][0]["content"] == "댓글 테스트"
