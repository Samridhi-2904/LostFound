from fastapi import APIRouter

from app.api.v1.admin_dashboard import router as admin_dashboard_router
from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.categories import admin_router as categories_admin_router
from app.api.v1.categories import router as categories_router
from app.api.v1.claims import router as claims_router
from app.api.v1.custody import admin_router as custody_admin_router
from app.api.v1.custody import router as custody_router
from app.api.v1.images import router as images_router
from app.api.v1.matches import router as matches_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.reports import router as reports_router
from app.api.v1.returns import router as returns_router
from app.api.v1.staff_reports import router as staff_reports_router
from app.api.v1.users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(categories_router)
api_router.include_router(categories_admin_router)
api_router.include_router(custody_router)
api_router.include_router(custody_admin_router)
api_router.include_router(reports_router)
api_router.include_router(claims_router)
api_router.include_router(returns_router)
api_router.include_router(images_router)
api_router.include_router(matches_router)
api_router.include_router(notifications_router)
api_router.include_router(staff_reports_router)
api_router.include_router(audit_router)
api_router.include_router(admin_dashboard_router)
