"""Tests for the Notices router (/api/notices)."""
import pytest


def _create_notice(client, headers, class_id=None):
    """Helper: create a notice and return response."""
    body = {
        "title": "공지사항",
        "content": "이번 주 수업 일정 변경",
        "author": "박선생",
        "important": True,
    }
    if class_id:
        body["class_id"] = class_id
    resp = client.post("/api/notices/", json=body, headers=headers)
    return resp


class TestCreateNotice:
    """POST /api/notices/"""

    def test_create_notice_teacher(self, client, teacher_headers, seed_class):
        resp = _create_notice(client, teacher_headers, class_id="c1")
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "공지사항"
        assert data["class_id"] == "c1"

    def test_create_notice_director(self, client, director_headers, seed_users):
        resp = _create_notice(client, director_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["class_id"] is None  # academy-wide

    def test_create_notice_teacher_no_class(self, client, teacher_headers, seed_users):
        """Teachers must provide class_id."""
        resp = _create_notice(client, teacher_headers)
        assert resp.status_code == 400

    def test_create_notice_forbidden(self, client, student_headers):
        resp = client.post("/api/notices/", json={
            "title": "학생 공지",
            "content": "내용",
            "author": "김배우",
            "important": False,
        }, headers=student_headers)
        assert resp.status_code == 403


class TestListNotices:
    """GET /api/notices/"""

    def test_list_notices(self, client, director_headers):
        _create_notice(client, director_headers)
        resp = client.get("/api/notices/", headers=director_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestGetNotice:
    """GET /api/notices/{id}"""

    def test_get_notice(self, client, director_headers):
        notice_id = _create_notice(client, director_headers).json()["id"]
        resp = client.get(f"/api/notices/{notice_id}", headers=director_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == notice_id

    def test_get_notice_not_found(self, client, seed_users, teacher_headers):
        resp = client.get("/api/notices/nonexistent", headers=teacher_headers)
        assert resp.status_code == 404


class TestUpdateNotice:
    """PUT /api/notices/{id}"""

    def test_update_notice(self, client, director_headers):
        notice_id = _create_notice(client, director_headers).json()["id"]
        resp = client.put(f"/api/notices/{notice_id}", json={
            "title": "수정된 공지",
            "important": False,
        }, headers=director_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "수정된 공지"
        assert data["important"] is False


class TestDeleteNotice:
    """DELETE /api/notices/{id}"""

    def test_delete_notice(self, client, director_headers):
        notice_id = _create_notice(client, director_headers).json()["id"]
        resp = client.delete(f"/api/notices/{notice_id}", headers=director_headers)
        assert resp.status_code == 200
        get_resp = client.get(f"/api/notices/{notice_id}", headers=director_headers)
        assert get_resp.status_code == 404
