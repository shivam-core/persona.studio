"""FastAPI application entrypoint for Persona Studio API."""

import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.db.session import SessionLocal
from app.api.routes.workspace import get_or_create_default_workspace
from app.api.routes.health import router as health_router
from app.api.routes.workspace import router as workspace_router
from app.api.routes.jobs import router as jobs_router
from app.api.routes.demo import router as demo_router
from app.api.routes.datasets import router as datasets_router
from app.api.routes.features import router as features_router
from app.api.routes.segmentations import router as segmentations_router
from app.api.routes.personas import router as personas_router
from app.api.routes.offerings import router as offerings_router
from app.api.routes.audiences import router as audiences_router
from app.api.routes.campaigns import router as campaigns_router
from app.api.routes.simulations import router as simulations_router
from app.api.routes.allocations import router as allocations_router
from app.api.routes.experiments import router as experiments_router
from app.api.routes.exports import router as exports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure default workspace exists
    try:
        with SessionLocal() as db:
            get_or_create_default_workspace(db)
    except Exception as exc:
        print(f"Warning on startup initialization: {exc}")
    yield


app = FastAPI(
    title="Persona Studio API",
    description="Customer Segments & Campaign Planner for Marketers API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
origins = [
    settings.APP_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Format Pydantic schema validation errors to standard contract."""
    req_id = str(uuid.uuid4())
    details = []
    for error in exc.errors():
        loc = ".".join(str(p) for p in error.get("loc", []))
        details.append({
            "field": loc,
            "reason": error.get("msg", "Invalid value"),
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "SCHEMA_VALIDATION_ERROR",
                "message": "Invalid request schema or parameters.",
                "details": details,
                "request_id": req_id,
            }
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Format HTTP exceptions to standard contract."""
    req_id = str(uuid.uuid4())
    code_map = {
        400: "INVALID_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        422: "UNPROCESSABLE_ENTITY",
        500: "INTERNAL_SERVER_ERROR",
    }
    code = code_map.get(exc.status_code, "ERROR")
    message = str(exc.detail) if isinstance(exc.detail, str) else "An error occurred."

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": [],
                "request_id": req_id,
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all unhandled exceptions returning clean 500 without stack traces."""
    req_id = str(uuid.uuid4())
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred.",
                "details": [],
                "request_id": req_id,
            }
        },
    )


# Register all API routers
app.include_router(health_router)
app.include_router(workspace_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")
app.include_router(datasets_router, prefix="/api/v1")
app.include_router(features_router, prefix="/api/v1")
app.include_router(segmentations_router, prefix="/api/v1")
app.include_router(personas_router, prefix="/api/v1")
app.include_router(offerings_router, prefix="/api/v1")
app.include_router(audiences_router, prefix="/api/v1")
app.include_router(campaigns_router, prefix="/api/v1")
app.include_router(simulations_router, prefix="/api/v1")
app.include_router(allocations_router, prefix="/api/v1")
app.include_router(experiments_router, prefix="/api/v1")
app.include_router(exports_router, prefix="/api/v1")
