"""Ca làm việc theo mô hình kết hợp.

Giờ dự kiến lấy từ mẫu ca (để cảnh báo quá giờ chưa cân trả). Kỳ đo thật của nhóm A tại Bếp là
từ lúc bếp trưởng ký nhận bàn giao đầu tiên (ca mở) đến lúc thủ kho cân trả (ca đóng).
"""

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.models import Shift, ShiftTemplate


def ensure_shifts(db: Session, d: date) -> list[Shift]:
    templates = db.scalars(select(ShiftTemplate).where(ShiftTemplate.active)).all()
    existing = {s.template_id: s for s in db.scalars(select(Shift).where(Shift.business_date == d))}
    out = []
    for t in templates:
        s = existing.get(t.id)
        if s is None:
            start = clock.at_local(d, t.start_time)
            end = clock.at_local(d, t.end_time)
            if end <= start:
                end += timedelta(days=1)
            s = Shift(template_id=t.id, business_date=d, name=t.name, planned_start=start, planned_end=end)
            db.add(s)
            db.flush()
        out.append(s)
    return sorted(out, key=lambda s: s.planned_start)


def shift_at(db: Session, t: datetime) -> Shift | None:
    """Ca có khung giờ dự kiến chứa thời điểm t."""
    d = clock.business_date(t)
    for day in (d - timedelta(days=1), d):
        for s in ensure_shifts(db, day):
            if s.planned_start <= t < s.planned_end:
                return s
    return None


def open_shift(db: Session) -> Shift | None:
    return db.scalars(select(Shift).where(Shift.status == "open").order_by(Shift.opened_at)).first()


def kitchen_shift(db: Session, t: datetime | None = None) -> Shift | None:
    """Ca dùng để gắn giao dịch tại Bếp: ca đang mở, nếu không có thì ca theo giờ."""
    return open_shift(db) or shift_at(db, t or clock.now())


def shift_for_handover(db: Session, t: datetime) -> Shift | None:
    """Ca nhận bàn giao đầu ca: ca theo giờ, hoặc ca sắp bắt đầu trong 60 phút tới."""
    s = shift_at(db, t)
    if s and s.status == "planned":
        return s
    d = clock.business_date(t)
    for day in (d, d + timedelta(days=1)):
        for cand in ensure_shifts(db, day):
            if cand.status == "planned" and t <= cand.planned_start <= t + timedelta(minutes=60):
                return cand
    return None


def mark_sod(shift: Shift, note: str) -> None:
    shift.sod_violation = True
    if note not in shift.sod_notes:
        shift.sod_notes = (shift.sod_notes + "\n" + note).strip()


def shift_dict(s: Shift | None) -> dict | None:
    if s is None:
        return None
    return {
        "id": s.id,
        "name": s.name,
        "business_date": s.business_date,
        "planned_start": s.planned_start,
        "planned_end": s.planned_end,
        "status": s.status,
        "opened_at": s.opened_at,
        "closed_at": s.closed_at,
        "head_chef_id": s.head_chef_id,
        "sod_violation": s.sod_violation,
        "sod_notes": s.sod_notes,
    }
