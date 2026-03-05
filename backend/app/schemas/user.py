import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.models.user import UserRole


def validate_password_rules(password: str) -> str:
    """8자 이상, 영문+숫자+특수문자 각 1개 이상."""
    if len(password) < 8:
        raise ValueError("비밀번호는 8자 이상이어야 합니다.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("비밀번호에 영문자가 포함되어야 합니다.")
    if not re.search(r"\d", password):
        raise ValueError("비밀번호에 숫자가 포함되어야 합니다.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("비밀번호에 특수문자가 포함되어야 합니다.")
    return password


class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole


class UserCreate(UserBase):
    password: str
    invite_code: str
    avatar: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password_rules(v)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return validate_password_rules(v)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
