from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.auth.security import require
from app.db import get_db
from app.models import Alert, Investigation, User
from app.services import alerts, investigations
from app.services.common import get_or_404

router = APIRouter(tags=["Điều tra & cảnh báo"])
manager = require(d.MANAGER)


@router.get("/investigations")
def list_investigations(status: str | None = None, db: Session = Depends(get_db), _: User = Depends(manager)):
    stmt = select(Investigation).order_by(Investigation.opened_at.desc()).limit(200)
    if status in ("open", "concluded"):
        stmt = stmt.where(Investigation.status == status)
    elif status == "overdue":
        stmt = stmt.where(Investigation.status == "open", Investigation.due_at < clock.now())
    elif status == "due_soon":
        now = clock.now()
        stmt = stmt.where(Investigation.status == "open", Investigation.due_at >= now,
                          Investigation.due_at < now + timedelta(hours=12))
    return [investigations.investigation_dict(db, i) for i in db.scalars(stmt)]


@router.get("/investigations/{iid}")
def get_investigation(iid: int, db: Session = Depends(get_db), _: User = Depends(manager)):
    return investigations.investigation_dict(db, get_or_404(db, Investigation, iid, "Phiếu điều tra"), detail=True)


class VerifyIn(BaseModel):
    found_qty: Decimal
    note: str = ""


@router.post("/investigations/{iid}/verify")
def verify(iid: int, body: VerifyIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    inv = get_or_404(db, Investigation, iid, "Phiếu điều tra")
    investigations.verify_false_out(db, inv, actor, body.found_qty, body.note)
    db.commit()
    return investigations.investigation_dict(db, inv, detail=True)


class AllocationIn(BaseModel):
    cause: str
    qty: Decimal
    receipt_line_id: int | None = None
    note: str = ""


class ConcludeIn(BaseModel):
    allocations: list[AllocationIn]
    note: str


@router.post("/investigations/{iid}/conclude")
def conclude(iid: int, body: ConcludeIn, db: Session = Depends(get_db), actor: User = Depends(require(d.MANAGER, d.HEAD_CHEF))):
    inv = get_or_404(db, Investigation, iid, "Phiếu điều tra")
    investigations.conclude(db, inv, actor, [a.model_dump() for a in body.allocations], body.note)
    db.commit()
    return investigations.investigation_dict(db, inv, detail=True)


@router.get("/alerts")
def list_alerts(status: str = "open", db: Session = Depends(get_db), _: User = Depends(manager)):
    stmt = select(Alert).order_by(Alert.at.desc()).limit(200)
    if status != "all":
        stmt = stmt.where(Alert.status == status)
    return [alerts.alert_dict(a) for a in db.scalars(stmt)]


@router.post("/alerts/{aid}/resolve")
def resolve_alert(aid: int, db: Session = Depends(get_db), actor: User = Depends(manager)):
    a = get_or_404(db, Alert, aid, "Cảnh báo")
    a.status = "resolved"
    a.resolved_at = clock.now()
    a.resolved_by = actor.id
    db.commit()
    return alerts.alert_dict(a)
