"""앱 버전 게이트 — 스토어 출시 앱(RN)이 런치 시 조회해 '업데이트 안내/강제'를 띄운다.

원장이 AppSetting(key-value)로 최신/최소 버전과 스토어 링크를 조절한다.
- 설치버전 < app_min_version   → 강제 업데이트(차단 모달)
- 설치버전 < app_latest_version → 권장 업데이트(닫기 가능한 안내)
기본값은 '아무 안내도 안 뜸'(min=0.0.0). 공개 엔드포인트 — 로그인 전에도 조회하므로 GATE/인증 없음.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.scene import AppSetting
from app.models.user import User, UserRole
from app.utils.auth import get_current_user

router = APIRouter()

# AppSetting에 값이 없을 때의 기본값 = 안내 없음(min=0.0.0, latest=현재 최초 배포버전)
_DEFAULTS = {
    "app_min_version": "0.0.0",
    "app_latest_version": "1.0.0",
    "app_ios_url": "",
    "app_android_url": "",
    "app_update_message": "",
}

# 응답(camelCase) 필드 → AppSetting 키
_FIELD_KEY = {
    "minVersion": "app_min_version",
    "latestVersion": "app_latest_version",
    "iosUrl": "app_ios_url",
    "androidUrl": "app_android_url",
    "message": "app_update_message",
}


def _get(db: Session, key: str) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value is not None else _DEFAULTS[key]


def _config(db: Session) -> dict:
    return {field: _get(db, key) for field, key in _FIELD_KEY.items()}


@router.get("/config")
def get_app_config(db: Session = Depends(get_db)):
    """앱 런치 시 버전 비교용 설정(공개). RN은 raw fetch로 이 camelCase를 그대로 읽는다."""
    return _config(db)


class AppConfigUpdate(BaseModel):
    minVersion: Optional[str] = None
    latestVersion: Optional[str] = None
    iosUrl: Optional[str] = None
    androidUrl: Optional[str] = None
    message: Optional[str] = None


@router.put("/config")
def set_app_config(
    data: AppConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """원장이 최신/최소 버전·스토어 링크를 갱신(전달된 필드만)."""
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 변경할 수 있어요.")
    for field, key in _FIELD_KEY.items():
        val = getattr(data, field)
        if val is None:
            continue
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = val
        else:
            db.add(AppSetting(key=key, value=val))
    db.commit()
    return _config(db)
