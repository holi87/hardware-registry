from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.devices import router as devices_router
from app.api.locations import router as locations_router
from app.api.setup import router as setup_router
from app.api.system import router as system_router
from app.api.vlans import router as vlans_router
from app.api.wifi import router as wifi_router

router = APIRouter()
router.include_router(system_router)
router.include_router(setup_router)
router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(locations_router)
router.include_router(vlans_router)
router.include_router(wifi_router)
router.include_router(devices_router)
