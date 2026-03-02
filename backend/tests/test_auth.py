"""Tests for the auth router: /api/auth/register and /api/auth/login."""


def test_register_success(client):
    """POST /api/auth/register with valid data returns 201 and user fields."""
    payload = {
        "email": "newuser@muse.com",
        "password": "Secure1!pass",
        "name": "홍길동",
        "role": "student",
    }
    resp = client.post("/api/auth/register", json=payload)

    assert resp.status_code == 201
    body = resp.json()
    assert "id" in body
    assert body["name"] == "홍길동"
    assert body["email"] == "newuser@muse.com"
    assert body["role"] == "student"


def test_register_duplicate_email(client):
    """Registering the same email twice returns 400."""
    payload = {
        "email": "dup@muse.com",
        "password": "Pass1234!",
        "name": "김중복",
        "role": "student",
    }
    resp1 = client.post("/api/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = client.post("/api/auth/register", json=payload)
    assert resp2.status_code == 400


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
