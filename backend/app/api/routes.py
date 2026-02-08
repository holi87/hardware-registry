from fastapi import APIRouter

from app.api.setup import router as setup_router
from app.api.system import router as system_router

router = APIRouter()
router.include_router(system_router)
router.include_router(setup_router)
