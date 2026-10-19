from contextlib import asynccontextmanager
from typing import Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown events."""
    # Startup actions (e.g. logging startup)
    yield
    # Shutdown actions (e.g. cleaning resources)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Role-based Lost and Found Management System API",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS middleware
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include versioned API routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
def health_check() -> Dict[str, str]:
    """Health check endpoint to verify system availability."""
    return {"status": "ok"}
