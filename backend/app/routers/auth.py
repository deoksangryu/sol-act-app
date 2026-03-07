from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.models.invite_code import InviteCode
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.utils.auth import verify_password, get_password_hash, create_access_token, get_current_user
from app.services.notification_service import emit_data_changed, get_all_user_ids
from typing import Optional, List
import uuid
import secrets
import string

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Validate invite code
    invite = db.query(InviteCode).filter(InviteCode.code == user_data.invite_code.upper()).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 인증코드입니다.")
    if invite.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 사용된 인증코드입니다.")
    # 90일 만료 체크
    if invite.created_at:
        from datetime import datetime, timedelta
        if datetime.utcnow() - invite.created_at > timedelta(days=90):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="만료된 인증코드입니다. (90일 초과)")
    if invite.role != user_data.role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="인증코드의 역할이 일치하지 않습니다.")

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다."
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        id=f"{user_data.role.value[0]}{uuid.uuid4().hex[:7]}",  # s1234567, t1234567, d1234567
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        hashed_password=hashed_password,
        avatar=user_data.avatar or f"https://picsum.photos/seed/{uuid.uuid4().hex[:8]}/200"
    )

    db.add(new_user)
    db.flush()

    # Mark invite code as used
    invite.used = True
    invite.used_by = new_user.id
    db.commit()
    db.refresh(new_user)

    all_ids = get_all_user_ids(db)
    if all_ids:
        await emit_data_changed(all_ids, "users")

    return new_user


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/login/oauth", response_model=Token)
def login_oauth(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """OAuth2 compatible login endpoint (for Swagger UI)"""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


# --- 인증코드 검증 ---

class VerifyCodeRequest(BaseModel):
    code: str


@router.post("/verify-code")
def verify_code(data: VerifyCodeRequest, db: Session = Depends(get_db)):
    """인증코드 유효성 확인 — 역할 반환"""
    invite = db.query(InviteCode).filter(InviteCode.code == data.code.upper()).first()
    if not invite or invite.used:
        raise HTTPException(status_code=400, detail="유효하지 않은 인증코드입니다.")
    if invite.created_at:
        from datetime import datetime, timedelta
        if datetime.utcnow() - invite.created_at > timedelta(days=90):
            raise HTTPException(status_code=400, detail="만료된 인증코드입니다. (90일 초과)")
    return {"valid": True, "role": invite.role.value}


# --- 아이디 찾기 / 비밀번호 초기화 ---

class FindEmailRequest(BaseModel):
    name: str


class ResetPasswordRequest(BaseModel):
    email: str
    name: str


@router.post("/find-email")
def find_email(data: FindEmailRequest, db: Session = Depends(get_db)):
    """이름으로 이메일(아이디) 찾기 — 마스킹 처리하여 반환"""
    users = db.query(User).filter(User.name == data.name).all()
    if not users:
        raise HTTPException(status_code=404, detail="해당 이름의 계정을 찾을 수 없습니다.")

    def mask_email(email: str) -> str:
        local, domain = email.split("@") if "@" in email else (email, "")
        if len(local) <= 2:
            masked = local[0] + "*" * (len(local) - 1)
        else:
            masked = local[:2] + "*" * (len(local) - 2)
        return f"{masked}@{domain}" if domain else masked

    return {
        "results": [
            {"email": mask_email(u.email), "role": u.role.value}
            for u in users
        ]
    }


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """이메일 + 이름 확인 후 임시 비밀번호 발급"""
    user = db.query(User).filter(
        User.email == data.email,
        User.name == data.name
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="이메일과 이름이 일치하는 계정을 찾을 수 없습니다.")

    # 임시 비밀번호 생성 (영문+숫자+특수문자 각각 1개 이상 보장, 총 10자)
    guaranteed = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
    ]
    filler = [secrets.choice(string.ascii_letters + string.digits) for _ in range(6)]
    pw_chars = guaranteed + filler
    # secrets 기반 셔플로 패턴 예측 방지
    for i in range(len(pw_chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        pw_chars[i], pw_chars[j] = pw_chars[j], pw_chars[i]
    temp_pw = ''.join(pw_chars)
    user.hashed_password = get_password_hash(temp_pw)
    db.commit()

    return {"temp_password": temp_pw}


# --- 초대 코드 관리 (원장 전용) ---

class InviteCodeCreate(BaseModel):
    role: str  # "student" or "teacher"
    count: int = 1
    memo: Optional[str] = None


class InviteCodeResponse(BaseModel):
    code: str
    role: str
    used: bool
    used_by: Optional[str] = None
    memo: Optional[str] = None
    created_at: Optional[str] = None


def _generate_invite_code(length: int = 8) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@router.post("/invite-codes", response_model=List[InviteCodeResponse])
def create_invite_codes(
    data: InviteCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 초대 코드를 생성할 수 있습니다.")
    if data.role not in ("student", "teacher"):
        raise HTTPException(status_code=400, detail="역할은 student 또는 teacher만 가능합니다.")
    if data.count < 1 or data.count > 20:
        raise HTTPException(status_code=400, detail="1~20개까지 생성 가능합니다.")

    codes = []
    for _ in range(data.count):
        while True:
            code = _generate_invite_code()
            if not db.query(InviteCode).filter(InviteCode.code == code).first():
                break
        invite = InviteCode(
            code=code,
            role=UserRole(data.role),
            memo=data.memo,
        )
        db.add(invite)
        codes.append(invite)
    db.commit()

    return [
        {
            "code": c.code,
            "role": c.role.value,
            "used": c.used,
            "used_by": c.used_by,
            "memo": c.memo,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in codes
    ]


@router.get("/invite-codes", response_model=List[InviteCodeResponse])
def list_invite_codes(
    unused_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=403, detail="원장만 조회할 수 있습니다.")

    query = db.query(InviteCode).order_by(InviteCode.created_at.desc())
    if unused_only:
        query = query.filter(InviteCode.used == False)
    codes = query.all()

    return [
        {
            "code": c.code,
            "role": c.role.value,
            "used": c.used,
            "used_by": c.used_by,
            "memo": c.memo,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in codes
    ]
