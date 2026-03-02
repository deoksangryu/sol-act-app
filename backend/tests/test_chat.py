"""Tests for the Chat router (/api/chat)."""
import pytest


class TestSendMessage:
    """POST /api/chat/messages"""

    def test_send_message(self, client, seed_class, student_headers):
        resp = client.post("/api/chat/messages", json={
            "class_id": "c1",
            "sender_id": "s1",
            "content": "안녕하세요!",
        }, headers=student_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "안녕하세요!"
        assert data["sender_id"] == "s1"
        assert data["sender_name"] == "김배우"
        assert data["sender_role"] == "student"
        assert data["avatar"] == "https://example.com/s1.png"

    def test_send_message_invalid_class(self, client, seed_users, student_headers):
        resp = client.post("/api/chat/messages", json={
            "class_id": "xxx",
            "sender_id": "s1",
            "content": "테스트",
        }, headers=student_headers)
        assert resp.status_code == 404

    def test_send_message_sender_id_ignored(self, client, seed_class, student_headers):
        """sender_id in body is ignored; the server uses the authenticated user's ID."""
        resp = client.post("/api/chat/messages", json={
            "class_id": "c1",
            "sender_id": "xxx",
            "content": "테스트",
        }, headers=student_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Server should use authenticated user (s1), not the body's sender_id
        assert data["sender_id"] == "s1"
        assert data["sender_name"] == "김배우"
        assert data["sender_role"] == "student"

    def test_send_message_unauthenticated(self, client, seed_class):
        resp = client.post("/api/chat/messages", json={
            "class_id": "c1",
            "sender_id": "s1",
            "content": "테스트",
        })
        assert resp.status_code == 401


class TestListMessages:
    """GET /api/chat/messages?class_id=..."""

    def test_list_messages(self, client, seed_class, student_headers, student2_headers):
        # Send two messages first
        client.post("/api/chat/messages", json={
            "class_id": "c1", "sender_id": "s1", "content": "첫 번째",
        }, headers=student_headers)
        client.post("/api/chat/messages", json={
            "class_id": "c1", "sender_id": "s2", "content": "두 번째",
        }, headers=student2_headers)

        resp = client.get("/api/chat/messages", params={"class_id": "c1"},
                          headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["content"] == "첫 번째"
        assert data[1]["content"] == "두 번째"

    def test_list_messages_pagination(self, client, seed_class, student_headers, student2_headers):
        # Send two messages
        client.post("/api/chat/messages", json={
            "class_id": "c1", "sender_id": "s1", "content": "A",
        }, headers=student_headers)
        client.post("/api/chat/messages", json={
            "class_id": "c1", "sender_id": "s2", "content": "B",
        }, headers=student2_headers)

        resp = client.get("/api/chat/messages", params={
            "class_id": "c1", "limit": 1, "offset": 0,
        }, headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_list_messages_unauthenticated(self, client, seed_class):
        resp = client.get("/api/chat/messages", params={"class_id": "c1"})
        assert resp.status_code == 401


class TestResponseFormat:
    """Verify all expected fields are present in chat message responses."""

    def test_response_format(self, client, seed_class, teacher_headers):
        resp = client.post("/api/chat/messages", json={
            "class_id": "c1",
            "sender_id": "t1",
            "content": "수업 시작합니다.",
        }, headers=teacher_headers)
        assert resp.status_code == 201
        data = resp.json()
        required_keys = {
            "id", "class_id", "sender_id", "sender_name",
            "sender_role", "avatar", "content", "timestamp",
        }
        assert required_keys.issubset(data.keys())
        # timestamp must be a non-empty string
        assert data["timestamp"]
        assert data["sender_name"] == "박선생"
        assert data["sender_role"] == "teacher"


class TestMarkRead:
    """PUT /api/chat/mark-read"""

    def test_mark_read(self, client, seed_class, student_headers):
        resp = client.put("/api/chat/mark-read",
                          params={"class_id": "c1"},
                          headers=student_headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "ok"

    def test_mark_read_unauthenticated(self, client, seed_class):
        resp = client.put("/api/chat/mark-read",
                          params={"class_id": "c1"})
        assert resp.status_code == 401


class TestUnreadCounts:
    """GET /api/chat/unread-counts"""

    def test_unread_counts(self, client, seed_class, student_headers, teacher_headers):
        # Teacher sends a message
        client.post("/api/chat/messages", json={
            "class_id": "c1", "sender_id": "t1", "content": "숙제 있어요",
        }, headers=teacher_headers)

        # Student checks unread counts
        resp = client.get("/api/chat/unread-counts",
                          params={"class_ids": "c1"},
                          headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("c1", 0) >= 1

    def test_unread_counts_unauthenticated(self, client, seed_class):
        resp = client.get("/api/chat/unread-counts",
                          params={"class_ids": "c1"})
        assert resp.status_code == 401


class TestLastMessages:
    """GET /api/chat/last-messages"""

    def test_last_messages(self, client, seed_class, student_headers):
        # Send a message first
        client.post("/api/chat/messages", json={
            "class_id": "c1", "sender_id": "s1", "content": "마지막 메시지",
        }, headers=student_headers)

        resp = client.get("/api/chat/last-messages",
                          params={"class_ids": "c1"},
                          headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "c1" in data
        assert data["c1"]["content"] == "마지막 메시지"

    def test_last_messages_unauthenticated(self, client, seed_class):
        resp = client.get("/api/chat/last-messages",
                          params={"class_ids": "c1"})
        assert resp.status_code == 401
