import hmac
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.security import (
    PASSWORD_POLICY_MESSAGE,
    generate_temporary_password,
    hash_password,
    validate_password_policy,
)
from app.core.settings import get_settings
from app.db.session import get_db
from app.models.location import Location
from app.models.user import User, UserRole
from app.models.user_root import UserRoot

router = APIRouter(prefix="/admin", tags=["admin"])


class ResetPasswordResponse(BaseModel):
    temporary_password: str


class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    is_active: bool
    must_change_password: bool
    root_ids: list[UUID]
    created_at: datetime


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str
    password: str
    role: UserRole = UserRole.USER
    is_active: bool = True
    root_ids: list[UUID] = Field(default_factory=list)


class UpdateUserRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    root_ids: list[UUID] | None = None


class SetUserPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    password: str
    must_change_password: bool = True


def _validate_root_ids(db: Session, root_ids: list[UUID]) -> list[UUID]:
    unique_root_ids = list(dict.fromkeys(root_ids))
    if not unique_root_ids:
        return []

    roots = db.scalars(select(Location.id).where(Location.id.in_(unique_root_ids), Location.id == Location.root_id)).all()
    valid_root_ids = set(roots)
    missing = [root_id for root_id in unique_root_ids if root_id not in valid_root_ids]
    if missing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more roots were not found")
    return unique_root_ids


def _read_user_root_ids(db: Session, user_id: UUID) -> list[UUID]:
    return list(db.scalars(select(UserRoot.root_id).where(UserRoot.user_id == user_id)).all())


def _set_user_root_ids(db: Session, user_id: UUID, root_ids: list[UUID]) -> None:
    db.execute(delete(UserRoot).where(UserRoot.user_id == user_id))
    for root_id in root_ids:
        db.add(UserRoot(user_id=user_id, root_id=root_id))


def _to_admin_user_response(db: Session, user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        root_ids=_read_user_root_ids(db, user.id),
        created_at=user.created_at,
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_admin_password(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    reset_key: str | None = Header(default=None, alias="X-Admin-Reset-Key"),
) -> ResetPasswordResponse:
    settings = get_settings()
    if not reset_key or not hmac.compare_digest(reset_key, settings.ADMIN_RESET_KEY):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin reset key")

    temporary_password = generate_temporary_password()
    current_admin.password_hash = hash_password(temporary_password)
    current_admin.must_change_password = True

    db.add(current_admin)
    db.commit()

    return ResetPasswordResponse(temporary_password=temporary_password)


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserResponse]:
    users = db.scalars(select(User).order_by(User.created_at.asc())).all()
    assignments = db.execute(select(UserRoot.user_id, UserRoot.root_id)).all()
    roots_by_user: dict[UUID, list[UUID]] = {}
    for user_id, root_id in assignments:
        roots_by_user.setdefault(user_id, []).append(root_id)

    return [
        AdminUserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            must_change_password=user.must_change_password,
            root_ids=roots_by_user.get(user.id, []),
            created_at=user.created_at,
        )
        for user in users
    ]


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    if not validate_password_policy(payload.password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PASSWORD_POLICY_MESSAGE)

    validated_root_ids = _validate_root_ids(db, payload.root_ids)
    if payload.role == UserRole.USER and not validated_root_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="USER must be assigned to at least one root")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists") from exc

    _set_user_root_ids(db, user.id, validated_root_ids)
    db.commit()
    db.refresh(user)
    return _to_admin_user_response(db, user)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: UUID,
    payload: UpdateUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.email is not None:
        user.email = payload.email.lower()
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    root_ids = payload.root_ids
    if root_ids is None:
        root_ids = _read_user_root_ids(db, user.id)
    validated_root_ids = _validate_root_ids(db, root_ids)

    role_after_update = payload.role if payload.role is not None else user.role
    if role_after_update == UserRole.USER and not validated_root_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="USER must be assigned to at least one root")

    _set_user_root_ids(db, user.id, validated_root_ids)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists") from exc

    db.refresh(user)
    return _to_admin_user_response(db, user)


@router.post("/users/{user_id}/set-password", response_model=AdminUserResponse)
def set_user_password(
    user_id: UUID,
    payload: SetUserPasswordRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not validate_password_policy(payload.password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PASSWORD_POLICY_MESSAGE)

    user.password_hash = hash_password(payload.password)
    user.must_change_password = payload.must_change_password

    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_admin_user_response(db, user)
