"""앱 버전 게이트 엔드포인트 테스트."""


def test_config_public_defaults(client):
    """로그인 없이 조회 가능 + 기본값(안내 없음)."""
    res = client.get("/api/app/config")
    assert res.status_code == 200
    d = res.json()
    assert d == {
        "minVersion": "0.0.0",
        "latestVersion": "1.0.0",
        "iosUrl": "",
        "androidUrl": "",
        "message": "",
    }


def test_director_updates_and_persists(client, director_headers):
    res = client.put(
        "/api/app/config",
        json={"minVersion": "1.1.0", "latestVersion": "1.2.0",
              "androidUrl": "https://play.google.com/x", "message": "새 버전!"},
        headers=director_headers,
    )
    assert res.status_code == 200
    assert res.json()["latestVersion"] == "1.2.0"
    # 부분 업데이트 후에도 다른 필드 유지 + 지속
    again = client.get("/api/app/config").json()
    assert again["minVersion"] == "1.1.0"
    assert again["androidUrl"] == "https://play.google.com/x"
    assert again["iosUrl"] == ""  # 안 보낸 필드는 기본값 유지


def test_partial_update_keeps_others(client, director_headers):
    client.put("/api/app/config", json={"latestVersion": "2.0.0"}, headers=director_headers)
    client.put("/api/app/config", json={"iosUrl": "https://apps.apple.com/x"}, headers=director_headers)
    d = client.get("/api/app/config").json()
    assert d["latestVersion"] == "2.0.0" and d["iosUrl"] == "https://apps.apple.com/x"


def test_non_director_forbidden(client, teacher_headers):
    res = client.put("/api/app/config", json={"latestVersion": "9.9.9"}, headers=teacher_headers)
    assert res.status_code == 403
