"""Tests for the users router: /api/users/ CRUD operations."""

from app.models.user import User


def test_list_users(client, seed_users):
    """GET /api/users/ returns all seeded users."""
    resp = client.get("/api/users/")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 4
    ids = {u["id"] for u in body}
    assert ids == {"s1", "s2", "t1", "d1"}


def test_list_users_filter_by_role(client, seed_users):
    """GET /api/users/?role=student returns only students."""
    resp = client.get("/api/users/?role=student")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    for user in body:
        assert user["role"] == "student"


def test_get_user(client, seed_users):
    """GET /api/users/s1 returns the correct user with expected fields."""
    resp = client.get("/api/users/s1")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "s1"
    assert body["name"] == "김배우"
    assert body["email"] == "student@muse.com"
    assert body["role"] == "student"


def test_get_user_not_found(client, seed_users):
    """GET /api/users/xxx for a non-existent user returns 404."""
    resp = client.get("/api/users/xxx")

    assert resp.status_code == 404


def test_update_user_self(client, student_headers):
    """PUT /api/users/s1 by the user themselves updates the name."""
    payload = {"name": "김새이름"}
    resp = client.put("/api/users/s1", json=payload, headers=student_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "김새이름"


def test_update_user_by_director(client, director_headers):
    """PUT /api/users/s1 by a director succeeds."""
    payload = {"name": "원장수정"}
    resp = client.put("/api/users/s1", json=payload, headers=director_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "원장수정"


def test_update_user_forbidden(client, student_headers):
    """PUT /api/users/t1 by a student (not self, not director) returns 403."""
    payload = {"name": "불법수정"}
    resp = client.put("/api/users/t1", json=payload, headers=student_headers)

    assert resp.status_code == 403


def test_delete_user_by_director(client, db, director_headers):
    """DELETE /api/users/s1 by a director succeeds and removes user from DB."""
    resp = client.delete("/api/users/s1", headers=director_headers)

    assert resp.status_code == 200
    assert resp.json()["message"] == "User deleted"

    # Verify user is actually gone from the database
    deleted_user = db.query(User).filter(User.id == "s1").first()
    assert deleted_user is None


def test_delete_user_forbidden(client, teacher_headers):
    """DELETE /api/users/s1 by a teacher returns 403."""
    resp = client.delete("/api/users/s1", headers=teacher_headers)

    assert resp.status_code == 403


def test_delete_user_not_found(client, director_headers):
    """DELETE /api/users/xxx for a non-existent user returns 404."""
    resp = client.delete("/api/users/xxx", headers=director_headers)

    assert resp.status_code == 404
