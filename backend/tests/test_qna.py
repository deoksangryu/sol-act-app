"""Tests for the Q&A router (/api/qna)."""
import pytest


def _create_question(client, headers):
    """Helper: create a question and return the response dict."""
    resp = client.post("/api/qna/questions", json={
        "title": "연기 질문",
        "content": "감정 표현 어떻게 하나요?",
    }, headers=headers)
    return resp


class TestCreateQuestion:
    """POST /api/qna/questions"""

    def test_create_question(self, client, seed_users, student_headers):
        resp = _create_question(client, student_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "연기 질문"
        assert data["author_name"] == "김배우"
        assert data["author_id"] == "s1"
        assert data["views"] == 0
        assert data["answers"] == []

    def test_create_question_author_from_token(self, client, seed_users, teacher_headers):
        """Verify author_id is derived from the authenticated user's token."""
        resp = client.post("/api/qna/questions", json={
            "title": "질문",
            "content": "내용",
        }, headers=teacher_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["author_id"] == "t1"
        assert data["author_name"] == "박선생"


class TestListAndGetQuestions:
    """GET /api/qna/questions and GET /api/qna/questions/{id}"""

    def test_list_questions(self, client, seed_users, student_headers):
        _create_question(client, student_headers)
        resp = client.get("/api/qna/questions")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        # Each question should have nested answers list
        assert "answers" in data[0]

    def test_get_question_increments_views(self, client, seed_users, student_headers):
        create_resp = _create_question(client, student_headers)
        qid = create_resp.json()["id"]

        resp1 = client.get(f"/api/qna/questions/{qid}")
        views1 = resp1.json()["views"]

        resp2 = client.get(f"/api/qna/questions/{qid}")
        views2 = resp2.json()["views"]

        assert views2 == views1 + 1


class TestAnswers:
    """POST answers to questions."""

    def test_create_answer(self, client, seed_users, student_headers, teacher_headers):
        qid = _create_question(client, student_headers).json()["id"]
        resp = client.post(f"/api/qna/questions/{qid}/answers", json={
            "content": "감정을 느끼세요.",
        }, headers=teacher_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "감정을 느끼세요."
        assert data["author_name"] == "박선생"
        assert data["author_role"] == "teacher"
        assert data["is_ai"] is False

    def test_ai_answer(self, client, seed_users, student_headers):
        qid = _create_question(client, student_headers).json()["id"]
        resp = client.post(f"/api/qna/questions/{qid}/answers/ai", headers=student_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_ai"] is True
        assert data["author_name"] == "AI 튜터"


class TestDeleteQuestion:
    """DELETE /api/qna/questions/{id}"""

    def test_delete_question_by_author(self, client, seed_users, student_headers):
        qid = _create_question(client, student_headers).json()["id"]
        resp = client.delete(f"/api/qna/questions/{qid}", headers=student_headers)
        assert resp.status_code == 200

    def test_delete_question_forbidden(self, client, seed_users, student_headers, student2_headers):
        # s2 is not the author (s1) and is not a teacher/director
        qid = _create_question(client, student_headers).json()["id"]
        resp = client.delete(f"/api/qna/questions/{qid}", headers=student2_headers)
        assert resp.status_code == 403


class TestDeleteAnswer:
    """DELETE /api/qna/answers/{id}"""

    def _create_answer(self, client, qid, headers):
        resp = client.post(f"/api/qna/questions/{qid}/answers", json={
            "content": "답변 내용",
        }, headers=headers)
        return resp.json()["id"]

    def test_delete_answer_by_teacher(self, client, seed_users, student_headers, teacher_headers):
        qid = _create_question(client, student_headers).json()["id"]
        aid = self._create_answer(client, qid, student_headers)
        resp = client.delete(f"/api/qna/answers/{aid}", headers=teacher_headers)
        assert resp.status_code == 200

    def test_delete_answer_forbidden(self, client, seed_users, student_headers):
        qid = _create_question(client, student_headers).json()["id"]
        aid = self._create_answer(client, qid, student_headers)
        resp = client.delete(f"/api/qna/answers/{aid}", headers=student_headers)
        assert resp.status_code == 403


class TestResponseFormat:
    """Verify expected fields in Q&A responses."""

    def test_response_format(self, client, seed_users, student_headers):
        resp = _create_question(client, student_headers)
        data = resp.json()
        required_keys = {"id", "title", "content", "author_id", "author_name", "views", "answers", "created_at"}
        assert required_keys.issubset(data.keys())
        assert isinstance(data["answers"], list)
