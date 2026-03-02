"""Tests for the Notices router (/api/notices)."""
import pytest


def _create_notice(client, teacher_headers):
    """Helper: create a notice and return response."""
    resp = client.post("/api/notices/", json={
        "title": "공지사항",
        "content": "이번 주 수업 일정 변경",
        "author": "박선생",
        "important": True,
    }, headers=teacher_headers)
    return resp


class TestCreateNotice:
    """POST /api/notices/"""

    def test_create_notice_teacher(self, client, teacher_headers):
        resp = _create_notice(client, teacher_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "공지사항"
        assert data["content"] == "이번 주 수업 일정 변경"
        assert data["author"] == "박선생"
        assert data["important"] is True
        assert "id" in data

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

    def test_list_notices(self, client, teacher_headers):
        _create_notice(client, teacher_headers)
        resp = client.get("/api/notices/")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestGetNotice:
    """GET /api/notices/{id}"""

    def test_get_notice(self, client, teacher_headers):
        notice_id = _create_notice(client, teacher_headers).json()["id"]
        resp = client.get(f"/api/notices/{notice_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == notice_id

    def test_get_notice_not_found(self, client, seed_users):
        resp = client.get("/api/notices/nonexistent")
        assert resp.status_code == 404


class TestUpdateNotice:
    """PUT /api/notices/{id}"""

    def test_update_notice(self, client, teacher_headers):
        notice_id = _create_notice(client, teacher_headers).json()["id"]
        resp = client.put(f"/api/notices/{notice_id}", json={
            "title": "수정된 공지",
            "important": False,
        }, headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "수정된 공지"
        assert data["important"] is False
        # Content should remain unchanged
        assert data["content"] == "이번 주 수업 일정 변경"


class TestDeleteNotice:
    """DELETE /api/notices/{id}"""

    def test_delete_notice(self, client, teacher_headers):
        notice_id = _create_notice(client, teacher_headers).json()["id"]
        resp = client.delete(f"/api/notices/{notice_id}", headers=teacher_headers)
        assert resp.status_code == 200
        # Confirm it is gone
        get_resp = client.get(f"/api/notices/{notice_id}")
        assert get_resp.status_code == 404
