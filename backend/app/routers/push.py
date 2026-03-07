from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.utils.auth import get_current_user
from app.config import settings
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
