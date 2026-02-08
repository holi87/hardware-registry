import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.security import generate_temporary_password, hash_password
from app.core.settings import get_settings
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class ResetPasswordResponse(BaseModel):
    temporary_password: str


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
