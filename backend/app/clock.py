"""Đồng hồ nghiệp vụ duy nhất của hệ thống.

Mọi code nghiệp vụ lấy giờ qua `now()`, không gọi `datetime.now()`. Ở chế độ demo, quản lý có
thể tua đồng hồ (độ lệch lưu trong bảng system_clock). Test và script seed dùng `set_fixed()`.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

VN = ZoneInfo("Asia/Ho_Chi_Minh")

_offset = timedelta(0)
_fixed: datetime | None = None


def now() -> datetime:
    if _fixed is not None:
        return _fixed
    return datetime.now(timezone.utc) + _offset


def offset_seconds() -> int:
    return int(_offset.total_seconds())


def set_offset(seconds: int) -> None:
    global _offset
    _offset = timedelta(seconds=seconds)


def set_fixed(dt: datetime | None) -> None:
    global _fixed
    _fixed = dt.astimezone(timezone.utc) if dt is not None else None


def advance(delta: timedelta) -> None:
    global _fixed, _offset
    if _fixed is not None:
        _fixed += delta
    else:
        _offset += delta


def local(dt: datetime) -> datetime:
    return dt.astimezone(VN)


def business_date(dt: datetime) -> date:
    return local(dt).date()


def at_local(d: date, t: time) -> datetime:
    """Giờ địa phương (VN) của ngày d, đổi ra UTC."""
    return datetime.combine(d, t, tzinfo=VN).astimezone(timezone.utc)


def day_bounds(d: date) -> tuple[datetime, datetime]:
    start = at_local(d, time(0, 0))
    return start, start + timedelta(days=1)


def load_offset(db) -> None:
    from app.models import SystemClock

    row = db.get(SystemClock, 1)
    set_offset(row.offset_seconds if row else 0)


def save_offset(db, seconds: int) -> None:
    from app.models import SystemClock

    row = db.get(SystemClock, 1)
    if row is None:
        row = SystemClock(id=1, offset_seconds=seconds)
        db.add(row)
    else:
        row.offset_seconds = seconds
    set_offset(seconds)
