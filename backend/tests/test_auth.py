"""Tests for the auth router: /api/auth/register and /api/auth/login."""
from app.models.invite_code import InviteCode
from app.models.user import UserRole


def test_register_success(client, db):
    """POST /api/auth/register with valid invite code returns 201."""
    db.add(InviteCode(code="TEST1234", role=UserRole.STUDENT))
    db.commit()

    payload = {
        "email": "newuser@muse.com",
        "password": "Secure1!pass",
        "name": "홍길동",
        "role": "student",
        "invite_code": "TEST1234",
    }
    resp = client.post("/api/auth/register", json=payload)

    assert resp.status_code == 201
    body = resp.json()
    assert "id" in body
    assert body["name"] == "홍길동"
    assert body["email"] == "newuser@muse.com"
    assert body["role"] == "student"

    # Verify code is marked as used
    code = db.query(InviteCode).filter(InviteCode.code == "TEST1234").first()
    assert code.used is True
    assert code.used_by == body["id"]


def test_register_invalid_code(client, db):
    """Registration with invalid code returns 400."""
    payload = {
        "email": "bad@muse.com",
        "password": "Pass1234!",
        "name": "김실패",
        "role": "student",
        "invite_code": "BADCODE1",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400


def test_register_used_code(client, db):
    """Registration with already-used code returns 400."""
    db.add(InviteCode(code="USED1234", role=UserRole.STUDENT, used=True, used_by="s99"))
    db.commit()

    payload = {
        "email": "used@muse.com",
        "password": "Pass1234!",
        "name": "김중복코드",
        "role": "student",
        "invite_code": "USED1234",
    }
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400


def test_register_duplicate_email(client, db):
    """Registering the same email twice returns 400."""
    db.add(InviteCode(code="CODE0001", role=UserRole.STUDENT))
    db.add(InviteCode(code="CODE0002", role=UserRole.STUDENT))
    db.commit()

    payload = {
        "email": "dup@muse.com",
        "password": "Pass1234!",
        "name": "김중복",
        "role": "student",
        "invite_code": "CODE0001",
    }
    resp1 = client.post("/api/auth/register", json=payload)
    assert resp1.status_code == 201

    payload["invite_code"] = "CODE0002"
    resp2 = client.post("/api/auth/register", json=payload)
    assert resp2.status_code == 400


def test_verify_code_valid(client, db):
    """POST /api/auth/verify-code with valid code returns role."""
    db.add(InviteCode(code="VERI1234", role=UserRole.TEACHER))
    db.commit()

    resp = client.post("/api/auth/verify-code", json={"code": "VERI1234"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["role"] == "teacher"


def test_verify_code_invalid(client, db):
    """POST /api/auth/verify-code with bad code returns 400."""
    resp = client.post("/api/auth/verify-code", json={"code": "NOPE1234"})
    assert resp.status_code == 400


def test_login_success(client, seed_users):
    """POST /api/auth/login with correct credentials returns 200 with token and user."""
    payload = {"email": "student@muse.com", "password": "password123"}
    resp = client.post("/api/auth/login", json=payload)

    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert "user" in body
    assert body["user"]["id"] == "s1"


def test_login_wrong_password(client, seed_users):
    """POST /api/auth/login with wrong password returns 401."""
    payload = {"email": "student@muse.com", "password": "wrongpassword"}
    resp = client.post("/api/auth/login", json=payload)

    assert resp.status_code == 401


def test_login_nonexistent_email(client, seed_users):
    """POST /api/auth/login with unknown email returns 401."""
    payload = {"email": "nobody@muse.com", "password": "password123"}
    resp = client.post("/api/auth/login", json=payload)

    assert resp.status_code == 401


def test_login_response_format(client, seed_users):
    """Login response uses snake_case keys (access_token, not accessToken)."""
    payload = {"email": "student@muse.com", "password": "password123"}
    resp = client.post("/api/auth/login", json=payload)

    assert resp.status_code == 200
    body = resp.json()

    # Verify snake_case keys are present
    assert "access_token" in body
    assert "token_type" in body

    # Verify camelCase keys are NOT present
    assert "accessToken" not in body
    assert "tokenType" not in body
