from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.user import User, UserRole
from app.models.user_root import UserRoot


def get_accessible_root_ids(db: Session, user: User) -> set[UUID]:
    if user.role == UserRole.ADMIN:
        return set(db.scalars(select(Location.id).where(Location.id == Location.root_id)).all())
    return set(db.scalars(select(UserRoot.root_id).where(UserRoot.user_id == user.id)).all())


def ensure_root_exists(db: Session, root_id: UUID) -> Location:
    root = db.get(Location, root_id)
    if root is None or root.id != root.root_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Root not found")
    return root


def require_root_access(db: Session, user: User, root_id: UUID) -> None:
    if root_id not in get_accessible_root_ids(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this root")
