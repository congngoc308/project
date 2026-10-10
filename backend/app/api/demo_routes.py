from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.auth.security import require
from app.config import settings
from app.db import get_db
from app.errors import Forbidden, Invalid
from app.models import User
from app.services import monitor
from app.services.common import audit

router = APIRouter(prefix="/demo", tags=["Đồng hồ demo"])


class ClockIn(BaseModel):
    advance_minutes: int | None = None
    set_to: datetime | None = None
    reset: bool = False


@router.get("/clock")
def get_clock():
    return {"now": clock.now(), "offset_seconds": clock.offset_seconds(), "demo_mode": settings.demo_mode}


@router.post("/clock")
def set_clock(body: ClockIn, db: Session = Depends(get_db), actor: User = Depends(require(d.MANAGER))):
    """Tua đồng hồ nghiệp vụ khi trình bày (chỉ ở chế độ demo, không lùi về quá khứ)."""
    if not settings.demo_mode:
        raise Forbidden("Chỉ dùng được ở chế độ demo")
    before = clock.offset_seconds()
    if body.reset:
        seconds = 0
    elif body.set_to is not None:
        real = clock.now() - timedelta(seconds=before)
        seconds = int((body.set_to - real).total_seconds())
    elif body.advance_minutes:
        if body.advance_minutes < 0:
            raise Invalid("Chỉ tua tới, không lùi đồng hồ")
        seconds = before + body.advance_minutes * 60
    else:
        raise Invalid("Không có thay đổi")
    if seconds < before and not body.reset:
        raise Invalid("Không lùi đồng hồ: dữ liệu đã ghi phải giữ đúng thứ tự thời gian")
    clock.save_offset(db, seconds)
    audit(db, actor.id, "demo.clock", "system_clock", 1, before={"offset": before}, after={"offset": seconds})
    db.commit()
    new_alerts = monitor.scan(db)
    db.commit()
    return {"now": clock.now(), "offset_seconds": seconds, "new_alerts": new_alerts}


@router.post("/scan")
def scan(db: Session = Depends(get_db), _: User = Depends(require(d.MANAGER))):
    n = monitor.scan(db)
    db.commit()
    return {"new_alerts": n}
