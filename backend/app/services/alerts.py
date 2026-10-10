from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, events
from app.models import Alert


def raise_alert(
    db: Session,
    kind: str,
    severity: str,
    title: str,
    body: str | None = None,
    *,
    ingredient_id: int | None = None,
    location: str | None = None,
    shift_id: int | None = None,
    ref: tuple[str, int] | None = None,
    dedupe: str | None = None,
) -> Alert | None:
    """Tạo cảnh báo cho quản lý; bỏ qua nếu đã có cảnh báo đang mở cùng dedupe."""
    if dedupe:
        exists = db.scalar(select(Alert.id).where(Alert.dedupe_key == dedupe, Alert.status == "open"))
        if exists:
            return None
    alert = Alert(
        at=clock.now(),
        kind=kind,
        severity=severity,
        title=title,
        body=body,
        ingredient_id=ingredient_id,
        location=location,
        shift_id=shift_id,
        ref_type=ref[0] if ref else None,
        ref_id=ref[1] if ref else None,
        dedupe_key=dedupe,
    )
    db.add(alert)
    db.flush()
    events.emit(db, events.MANAGER, "alert", {"id": alert.id, "kind": kind, "severity": severity, "title": title})
    return alert


def resolve_by_key(db: Session, dedupe: str, user_id: int | None = None) -> None:
    for a in db.scalars(select(Alert).where(Alert.dedupe_key == dedupe, Alert.status == "open")):
        a.status = "resolved"
        a.resolved_at = clock.now()
        a.resolved_by = user_id


def alert_dict(a: Alert) -> dict:
    return {
        "id": a.id,
        "at": a.at,
        "kind": a.kind,
        "severity": a.severity,
        "title": a.title,
        "body": a.body,
        "ingredient_id": a.ingredient_id,
        "location": a.location,
        "shift_id": a.shift_id,
        "ref_type": a.ref_type,
        "ref_id": a.ref_id,
        "status": a.status,
        "resolved_at": a.resolved_at,
    }
