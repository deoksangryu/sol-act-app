from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.invite_code import InviteCode
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.utils.auth import verify_password, get_password_hash, create_access_token
from app.services.notification_service import emit_data_changed, get_all_user_ids
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

    # 임시 비밀번호 생성 (영문+숫자+특수문자 포함 10자)
    alphabet = string.ascii_letters + string.digits
    temp_pw = ''.join(secrets.choice(alphabet) for _ in range(8)) + secrets.choice("!@#$%") + secrets.choice(string.digits)
    user.hashed_password = get_password_hash(temp_pw)
    db.commit()

    return {"temp_password": temp_pw}
