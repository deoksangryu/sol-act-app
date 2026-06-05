from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.models.device_token import DeviceToken
from app.models.user import User
from app.utils.auth import get_current_user
from app.config import settings
from typing import Optional
import uuid

router = APIRouter()


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.post("/subscribe")
def subscribe(
    data: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Upsert: update if endpoint exists, create otherwise
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint
    ).first()

    if existing:
        existing.user_id = current_user.id
        existing.p256dh_key = data.p256dh
        existing.auth_key = data.auth
    else:
        sub = PushSubscription(
            id=f"push{uuid.uuid4().hex[:7]}",
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh_key=data.p256dh,
            auth_key=data.auth,
        )
        db.add(sub)

    db.commit()
    return {"ok": True}


@router.delete("/unsubscribe")
def unsubscribe(
    data: PushSubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"ok": True}


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


# ── 네이티브 푸시 디바이스 토큰 (FCM=android / APNs=ios) ──

class DeviceTokenRequest(BaseModel):
    token: str
    platform: str  # 'ios' | 'android'


@router.post("/device-token")
def register_device_token(
    data: DeviceTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """네이티브 앱이 발급받은 디바이스 토큰 등록(upsert). 동시 등록 경합에 안전."""
    from sqlalchemy.exc import IntegrityError
    platform = data.platform if data.platform in ("ios", "android") else "android"

    def _update(tok: DeviceToken):
        tok.user_id = current_user.id
        tok.platform = platform

    existing = db.query(DeviceToken).filter(DeviceToken.token == data.token).first()
    if existing:
        _update(existing)
        db.commit()
        return {"ok": True}

    # 신규 토큰 — 동시 요청이 먼저 넣었으면 UniqueViolation → 롤백 후 갱신(500 방지)
    try:
        db.add(DeviceToken(
            id=f"dt{uuid.uuid4().hex[:8]}",
            user_id=current_user.id,
            token=data.token,
            platform=platform,
        ))
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(DeviceToken).filter(DeviceToken.token == data.token).first()
        if existing:
            _update(existing)
            db.commit()
    return {"ok": True}


class DeviceTokenDelete(BaseModel):
    token: str


@router.delete("/device-token")
def remove_device_token(
    data: DeviceTokenDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(DeviceToken).filter(
        DeviceToken.token == data.token,
        DeviceToken.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"ok": True}
