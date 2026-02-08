import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import PASSWORD_POLICY_MESSAGE, hash_password, validate_password_policy
from app.db.session import get_db
from app.models.location import Location
from app.models.user import User, UserRole
from app.models.user_root import UserRoot

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupStatusResponse(BaseModel):
    needs_setup: bool


class SetupAdminRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str
    password: str


class SetupAdminResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole


def _needs_setup(db: Session) -> bool:
    admin_exists = db.scalar(select(User.id).where(User.role == UserRole.ADMIN).limit(1))
    return admin_exists is None


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusResponse:
    return SetupStatusResponse(needs_setup=_needs_setup(db))


@router.post("/admin", response_model=SetupAdminResponse, status_code=status.HTTP_201_CREATED)
def create_first_admin(payload: SetupAdminRequest, db: Session = Depends(get_db)) -> SetupAdminResponse:
    if not _needs_setup(db):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Setup already completed")

    if not validate_password_policy(payload.password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=PASSWORD_POLICY_MESSAGE)

    root_id = uuid.uuid4()
    admin = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.ADMIN,
        is_active=True,
    )
    root_location = Location(
        id=root_id,
        name="Dom",
        parent_id=None,
        root_id=root_id,
        notes="Root location created during bootstrap setup",
    )

    db.add(admin)
    db.add(root_location)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists") from exc

    db.add(UserRoot(user_id=admin.id, root_id=root_id))
    db.commit()
    db.refresh(admin)

    return SetupAdminResponse(id=admin.id, email=admin.email, role=admin.role)
