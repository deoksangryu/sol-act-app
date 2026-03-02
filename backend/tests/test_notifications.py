"""Tests for the Notifications router (/api/notifications)."""
import pytest


def _create_notification(client, headers, user_id="s1"):
    """Helper: create a notification and return response."""
    resp = client.post("/api/notifications/", json={
        "user_id": user_id,
        "type": "info",
        "message": "알림 테스트입니다.",
    }, headers=headers)
    return resp


class TestCreateNotification:
    """POST /api/notifications/"""

    def test_create_notification(self, client, seed_users, student_headers):
        resp = _create_notification(client, student_headers, "s1")
        assert resp.status_code == 201
        data = resp.json()
        assert data["type"] == "info"
        assert data["message"] == "알림 테스트입니다."
        assert data["read"] is False
        assert "id" in data


class TestListNotifications:
    """GET /api/notifications/"""

    def test_list_notifications(self, client, seed_users, student_headers):
        _create_notification(client, student_headers, "s1")
        _create_notification(client, student_headers, "s1")
        resp = client.get("/api/notifications/", headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        # All should belong to s1
        for item in data:
            assert item["read"] is False


class TestMarkRead:
    """PUT /api/notifications/{id}"""

    def test_mark_read(self, client, seed_users, student_headers):
        noti_id = _create_notification(client, student_headers, "s1").json()["id"]
        resp = client.put(f"/api/notifications/{noti_id}", json={"read": True}, headers=student_headers)
        assert resp.status_code == 200
        assert resp.json()["read"] is True


class TestMarkAllRead:
    """PUT /api/notifications/mark-all-read"""

    def test_mark_all_read(self, client, seed_users, student_headers):
        _create_notification(client, student_headers, "s1")
        _create_notification(client, student_headers, "s1")

        resp = client.put("/api/notifications/mark-all-read", headers=student_headers)
        assert resp.status_code == 200

        # Verify all are read now
        list_resp = client.get("/api/notifications/", headers=student_headers)
        for item in list_resp.json():
            assert item["read"] is True


class TestDeleteNotification:
    """DELETE /api/notifications/{id}"""

    def test_delete_notification(self, client, seed_users, student_headers):
        noti_id = _create_notification(client, student_headers, "s1").json()["id"]
        resp = client.delete(f"/api/notifications/{noti_id}", headers=student_headers)
        assert resp.status_code == 200

        # Confirm it is gone
        list_resp = client.get("/api/notifications/", headers=student_headers)
        ids = [n["id"] for n in list_resp.json()]
        assert noti_id not in ids


class TestNotFound:
    """PUT /api/notifications/xxx -> 404"""

    def test_not_found(self, client, seed_users, student_headers):
        resp = client.put("/api/notifications/xxx", json={"read": True}, headers=student_headers)
        assert resp.status_code == 404
