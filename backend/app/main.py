import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app import clock, events
from app.api import (
    auth_routes,
    catalog_routes,
    demo_routes,
    investigation_routes,
    order_routes,
    report_routes,
    stock_routes,
    stream_routes,
    user_routes,
)
from app.config import settings
from app.db import SessionLocal
from app.errors import DomainError

log = logging.getLogger("qlb")


def run_scan() -> int:
    from app.services import monitor

    with SessionLocal() as db:
        # Nạp lại độ lệch đồng hồ demo (có thể vừa được script seed đặt lại từ bên ngoài).
        clock.load_offset(db)
        n = monitor.scan(db)
        db.commit()
        return n


async def _scan_loop() -> None:
    while True:
        try:
            await run_in_threadpool(run_scan)
        except Exception:  # job nền không được làm sập ứng dụng
            log.exception("Quét cảnh báo lỗi")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    events.bind_loop(asyncio.get_running_loop())
    with SessionLocal() as db:
        clock.load_offset(db)
    task = asyncio.create_task(_scan_loop()) if settings.run_jobs else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Quản lý vận hành bếp", version="1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error(_: Request, exc: DomainError):
    return JSONResponse({"detail": exc.message, "data": exc.data}, status_code=exc.status_code)


@app.exception_handler(ValueError)
async def value_error(_: Request, exc: ValueError):
    return JSONResponse({"detail": str(exc)}, status_code=400)


for module in (
    auth_routes,
    user_routes,
    catalog_routes,
    order_routes,
    stock_routes,
    investigation_routes,
    report_routes,
    demo_routes,
    stream_routes,
):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True, "now": clock.now(), "demo_mode": settings.demo_mode}
