from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_user
from app.core.jwt import create_access_token, create_refresh_token, decode_token
from app.core.security import verify_password
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthTokensResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: UUID
    email: str
    role: str
    is_active: bool


class AdminCheckResponse(BaseModel):
    ok: bool


def authenticate_credentials(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.lower()).limit(1))
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


@router.post("/login", response_model=AuthTokensResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthTokensResponse:
    user = authenticate_credentials(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return AuthTokensResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
    )


@router.post("/refresh", response_model=AuthTokensResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AuthTokensResponse:
    claims = decode_token(payload.refresh_token, expected_type="refresh")
    subject = claims.get("sub")
    if subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = db.get(User, UUID(subject))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return AuthTokensResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
    )


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(require_user)) -> MeResponse:
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role.value,
        is_active=current_user.is_active,
    )


@router.get("/admin-check", response_model=AdminCheckResponse)
def admin_check(_: User = Depends(require_admin)) -> AdminCheckResponse:
    return AdminCheckResponse(ok=True)
