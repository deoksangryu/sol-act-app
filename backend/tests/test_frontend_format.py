"""Tests verifying backend responses match what the frontend expects.

The frontend TypeScript types use camelCase. The backend returns snake_case.
A middleware or client-side transform converts snake_case -> camelCase.
These tests verify the backend sends the correct snake_case keys so that
conversion produces the expected camelCase keys on the frontend.

Some tests intentionally document known mismatches between the backend
response shape and the frontend TypeScript interface.
"""
import re
import pytest
from datetime import date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CAMEL_CASE_RE = re.compile(r"[a-z][A-Z]")


def _has_camel_case_key(obj):
    """Return True if any key in the (possibly nested) object is camelCase."""
    if isinstance(obj, dict):
        for key in obj:
            if CAMEL_CASE_RE.search(key):
                return True
            if _has_camel_case_key(obj[key]):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if _has_camel_case_key(item):
                return True
    return False


# ---------------------------------------------------------------------------
# Assignment response keys
# ---------------------------------------------------------------------------

class TestAssignmentResponseKeys:
    """
    Frontend type: Assignment
    Expected camelCase keys after conversion: studentId, studentName, dueDate,
    submissionText, submissionFileUrl, aiAnalysis, createdAt, updatedAt
    Backend must return: student_id, student_name, due_date, submission_text,
    submission_file_url, ai_analysis, created_at, updated_at
    """

    def test_assignment_response_keys(self, client, seed_users, teacher_headers):
        resp = client.post("/api/assignments/", json={
            "title": "독백 연습",
            "description": "셰익스피어 독백 1편",
            "due_date": "2025-12-31T00:00:00",
            "student_id": "s1",
        }, headers=teacher_headers)
        assert resp.status_code == 201
        data = resp.json()
        expected_keys = {
            "student_id", "student_name", "due_date",
            "submission_text", "submission_file_url",
            "ai_analysis", "created_at", "updated_at",
        }
        assert expected_keys.issubset(data.keys())


# ---------------------------------------------------------------------------
# Lesson response keys
# ---------------------------------------------------------------------------

class TestLessonResponseKeys:
    """
    Frontend type: Lesson
    Expected camelCase keys: className, teacherName, startTime, endTime,
    lessonType, isPrivate, privateStudentIds
    """

    def test_lesson_response_keys(self, client, seed_lesson, teacher_headers):
        resp = client.get("/api/lessons/lsn001", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        expected_keys = {
            "class_name", "teacher_name", "start_time", "end_time",
            "lesson_type", "is_private", "private_student_ids",
        }
        assert expected_keys.issubset(data.keys())


# ---------------------------------------------------------------------------
# Evaluation scores nested structure
# ---------------------------------------------------------------------------

class TestEvaluationScoresNested:
    """
    Frontend type: Evaluation.scores = { acting, expression, creativity, teamwork, effort }
    Backend returns scores as a dict with these exact keys.
    """

    def test_evaluation_scores_nested(self, client, seed_class, teacher_headers):
        resp = client.post("/api/evaluations/", json={
            "student_id": "s1",
            "class_id": "c1",
            "subject": "acting",
            "period": "2025년 1월",
            "scores": {
                "acting": 4,
                "expression": 3,
                "creativity": 5,
                "teamwork": 4,
                "effort": 5,
            },
            "comment": "잘하고 있습니다.",
        }, headers=teacher_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert "scores" in data
        scores = data["scores"]
        assert isinstance(scores, dict)
        score_keys = {"acting", "expression", "creativity", "teamwork", "effort"}
        assert score_keys == set(scores.keys())
        assert all(isinstance(v, int) for v in scores.values())


# ---------------------------------------------------------------------------
# Audition checklists field
# ---------------------------------------------------------------------------

class TestAuditionChecklistsField:
    """
    Frontend type: CompetitionEvent uses 'checklist' (singular) with items
    having 'text' and 'completed'. Backend returns 'checklists' (plural)
    with items having 'content' and 'is_checked'.
    This test documents the backend's actual shape.
    """

    def test_audition_checklists_field(self, client, seed_users, student_headers):
        # Create audition
        aud_resp = client.post("/api/auditions/", json={
            "title": "겨울 오디션",
            "description": "겨울 시즌 오디션",
            "date": "2025-12-01T10:00:00",
            "location": "대극장",
            "audition_type": "audition",
        }, headers=student_headers)
        assert aud_resp.status_code == 201
        aud_id = aud_resp.json()["id"]

        # Add checklist item
        cl_resp = client.post(f"/api/auditions/{aud_id}/checklists", json={
            "content": "자기소개 준비",
            "sort_order": 0,
        }, headers=student_headers)
        assert cl_resp.status_code == 201

        # Fetch audition and verify checklists structure
        get_resp = client.get(f"/api/auditions/{aud_id}", headers=student_headers)
        assert get_resp.status_code == 200
        data = get_resp.json()

        # Backend uses "checklists" (plural)
        assert "checklists" in data
        assert isinstance(data["checklists"], list)
        assert len(data["checklists"]) == 1

        item = data["checklists"][0]
        # Backend uses "content" and "is_checked"
        assert "content" in item
        assert "is_checked" in item
        assert item["content"] == "자기소개 준비"
        assert item["is_checked"] is False


# ---------------------------------------------------------------------------
# Notice has created_at (frontend expects "date")
# ---------------------------------------------------------------------------

class TestNoticeHasCreatedAt:
    """
    Frontend Notice type has a 'date' field.
    Backend returns 'created_at'. This documents the mismatch:
    the frontend must map created_at -> date.
    """

    def test_notice_has_created_at(self, client, director_headers):
        resp = client.post("/api/notices/", json={
            "title": "알림 테스트",
            "content": "내용",
            "author": "최원장",
            "important": False,
        }, headers=director_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Backend sends "created_at", NOT "date"
        assert "created_at" in data


# ---------------------------------------------------------------------------
# Notification has created_at (frontend expects "date")
# ---------------------------------------------------------------------------

class TestNotificationHasCreatedAt:
    """
    Frontend Notification type has a 'date' field.
    Backend returns 'created_at'. Same mismatch pattern as Notice.
    """

    def test_notification_has_created_at(self, client, seed_users, student_headers):
        resp = client.post("/api/notifications/", json={
            "user_id": "s1",
            "type": "info",
            "message": "알림",
        }, headers=student_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Backend sends "created_at", NOT "date"
        assert "created_at" in data


# ---------------------------------------------------------------------------
# Portfolio tags is a string (frontend expects array)
# ---------------------------------------------------------------------------

class TestPortfolioTagsIsString:
    """
    Frontend PortfolioItem type defines tags as string[].
    Backend stores tags as a comma-separated string and returns it as-is.
    This documents the mismatch: frontend must split the string into an array.
    """

    def test_portfolio_tags_is_string(self, client, seed_users, student_headers):
        resp = client.post("/api/portfolios/", json={
            "title": "첫 독백",
            "description": "햄릿 독백 연습",
            "video_url": "https://example.com/video.mp4",
            "category": "monologue",
            "tags": "a,b",
        }, headers=student_headers)
        assert resp.status_code == 201
        data = resp.json()
        # Backend returns tags as a string, not a list
        assert isinstance(data["tags"], str)
        assert data["tags"] == "a,b"


# ---------------------------------------------------------------------------
# Chat message response
# ---------------------------------------------------------------------------

class TestChatMessageResponse:
    """Verify chat message response has all expected fields."""

    def test_chat_message_response(self, client, seed_class, student_headers):
        resp = client.post("/api/chat/messages", json={
            "class_id": "c1",
            "sender_id": "s1",
            "content": "안녕하세요",
        }, headers=student_headers)
        assert resp.status_code == 201
        data = resp.json()
        expected_keys = {"sender_name", "sender_role", "avatar", "timestamp"}
        assert expected_keys.issubset(data.keys())
        assert data["sender_name"] == "김배우"
        assert data["sender_role"] == "student"


# ---------------------------------------------------------------------------
# All responses use snake_case (no camelCase keys)
# ---------------------------------------------------------------------------

class TestAllResponsesSnakeCase:
    """
    Backend must return snake_case keys everywhere.
    Verify a sample of endpoints have zero camelCase keys.
    """

    def test_all_responses_snake_case(self, client, seed_class, seed_lesson, teacher_headers, student_headers, director_headers):
        # 1. Lesson
        lesson_resp = client.get("/api/lessons/lsn001", headers=teacher_headers)
        assert lesson_resp.status_code == 200
        assert not _has_camel_case_key(lesson_resp.json()), \
            f"Lesson response contains camelCase keys: {lesson_resp.json()}"

        # 2. Assignment
        asgn_resp = client.post("/api/assignments/", json={
            "title": "과제",
            "description": "설명",
            "due_date": "2025-12-31T00:00:00",
            "student_id": "s1",
        }, headers=teacher_headers)
        assert asgn_resp.status_code == 201
        assert not _has_camel_case_key(asgn_resp.json()), \
            f"Assignment response contains camelCase keys: {asgn_resp.json()}"

        # 3. Chat message
        chat_resp = client.post("/api/chat/messages", json={
            "class_id": "c1",
            "sender_id": "s1",
            "content": "메시지",
        }, headers=student_headers)
        assert chat_resp.status_code == 201
        assert not _has_camel_case_key(chat_resp.json()), \
            f"Chat response contains camelCase keys: {chat_resp.json()}"

        # 4. Notice
        notice_resp = client.post("/api/notices/", json={
            "title": "공지",
            "content": "내용",
            "author": "최원장",
            "important": False,
        }, headers=director_headers)
        assert notice_resp.status_code == 201
        assert not _has_camel_case_key(notice_resp.json()), \
            f"Notice response contains camelCase keys: {notice_resp.json()}"

        # 5. Notification
        noti_resp = client.post("/api/notifications/", json={
            "user_id": "s1",
            "type": "info",
            "message": "알림",
        }, headers=student_headers)
        assert noti_resp.status_code == 201
        assert not _has_camel_case_key(noti_resp.json()), \
            f"Notification response contains camelCase keys: {noti_resp.json()}"
