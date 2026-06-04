"""네이티브 푸시(FCM=Android, APNs=iOS) 발송.

설계 원칙: 자격증명/패키지가 없으면 **조용히 무동작**한다(웹푸시 _send_web_push_sync 와 동일).
따라서 자격증명을 넣기 전에도 백엔드는 정상 구동하며, 넣는 즉시 켜진다.

활성화하려면:
  - Android: settings.FCM_CREDENTIALS_FILE = Firebase 서비스계정 JSON 경로 (+ `pip install firebase-admin`)
  - iOS: settings.APNS_KEY_FILE/.APNS_KEY_ID/.APNS_TEAM_ID 설정 (+ `pip install "httpx[http2]"`)
"""
import json
import logging
import threading
import time
from typing import List, Optional

logger = logging.getLogger(__name__)

_fcm_initialized = False


def native_push_configured() -> bool:
    from app.config import settings
    return bool(settings.FCM_CREDENTIALS_FILE or (settings.APNS_KEY_FILE and settings.APNS_KEY_ID and settings.APNS_TEAM_ID))


def _ensure_fcm_app():
    """firebase-admin 앱을 1회 초기화. 실패/미설정 시 None."""
    global _fcm_initialized
    from app.config import settings
    if not settings.FCM_CREDENTIALS_FILE:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FCM_CREDENTIALS_FILE)
            firebase_admin.initialize_app(cred)
        _fcm_initialized = True
        return firebase_admin.get_app()
    except ImportError:
        logger.warning("firebase-admin 미설치 — Android 푸시 비활성 (pip install firebase-admin)")
        return None
    except Exception as e:
        logger.warning(f"FCM init 실패: {e}")
        return None


def _send_fcm(tokens: List[str], title: str, body: str, data: Optional[dict]) -> None:
    if not tokens or not _ensure_fcm_app():
        return
    try:
        from firebase_admin import messaging
        for t in tokens:
            try:
                messaging.send(messaging.Message(
                    token=t,
                    notification=messaging.Notification(title=title, body=body),
                    data={k: str(v) for k, v in (data or {}).items()},
                ))
            except Exception as e:
                logger.warning(f"FCM 전송 실패(token {t[:12]}…): {e}")
    except Exception as e:
        logger.warning(f"FCM 전송 오류: {e}")


def _send_apns(tokens: List[str], title: str, body: str, data: Optional[dict]) -> None:
    from app.config import settings
    if not tokens or not (settings.APNS_KEY_FILE and settings.APNS_KEY_ID and settings.APNS_TEAM_ID):
        return
    try:
        import httpx
        from jose import jwt as jose_jwt  # 프로젝트 기존 의존성(python-jose) 재사용
        with open(settings.APNS_KEY_FILE) as f:
            key = f.read()
        provider_jwt = jose_jwt.encode(
            {"iss": settings.APNS_TEAM_ID, "iat": int(time.time())},
            key, algorithm="ES256", headers={"kid": settings.APNS_KEY_ID},
        )
        host = "api.sandbox.push.apple.com" if settings.APNS_USE_SANDBOX else "api.push.apple.com"
        payload = {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}}
        if data:
            payload.update({k: str(v) for k, v in data.items()})
        body_bytes = json.dumps(payload).encode()
        # APNs는 HTTP/2 필수
        with httpx.Client(http2=True, timeout=10) as client:
            for t in tokens:
                try:
                    r = client.post(
                        f"https://{host}/3/device/{t}",
                        headers={
                            "authorization": f"bearer {provider_jwt}",
                            "apns-topic": settings.APNS_BUNDLE_ID,
                            "apns-push-type": "alert",
                        },
                        content=body_bytes,
                    )
                    if r.status_code != 200:
                        logger.warning(f"APNs 전송 {r.status_code}: {r.text[:120]}")
                except Exception as e:
                    logger.warning(f"APNs 전송 실패(token {t[:12]}…): {e}")
    except ImportError:
        logger.warning('APNs 의존성 미설치 — iOS 푸시 비활성 (pip install "httpx[http2]")')
    except Exception as e:
        logger.warning(f"APNs 전송 오류: {e}")


def send_native_push_sync(user_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
    """해당 사용자의 모든 디바이스 토큰으로 네이티브 푸시 발송(동기). 절대 예외를 던지지 않음."""
    if not native_push_configured():
        return
    try:
        from app.database import SessionLocal
        from app.models.device_token import DeviceToken
        db = SessionLocal()
        try:
            rows = db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()
            ios = [r.token for r in rows if r.platform == "ios"]
            android = [r.token for r in rows if r.platform == "android"]
        finally:
            db.close()
        if android:
            _send_fcm(android, title, body, data)
        if ios:
            _send_apns(ios, title, body, data)
    except Exception as e:
        logger.warning(f"native push 실패({user_id}): {e}")


def send_native_push(user_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
    """fire-and-forget(백그라운드 스레드)."""
    if not native_push_configured():
        return
    threading.Thread(
        target=send_native_push_sync,
        args=(user_id, title, body, data),
        daemon=True,
    ).start()
