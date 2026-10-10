"""Quét cảnh báo theo thời gian (5.9): quy trình bị bỏ qua, phiếu quá hạn, hủy/làm lại bất thường.

Chạy mỗi phút và ngay sau khi tua đồng hồ demo.
"""

from collections import Counter
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.models import CountLine, CountSession, Handover, Ingredient, Investigation, MenuItem, OrderItem, Shift, StockTxn, User
from app.services import alerts, shifts
from app.services.common import get_setting
from app.services.format import fmt_money


def scan(db: Session) -> int:
    now = clock.now()
    before = db.scalar(select(func.count()).select_from(alerts.Alert)) or 0
    today = clock.business_date(now)
    shifts.ensure_shifts(db, today)

    sign_grace = timedelta(minutes=int(get_setting(db, "handover_sign_grace_minutes")))
    for h in db.scalars(select(Handover).where(Handover.status == "pending", Handover.issued_at < now - sign_grace)):
        alerts.raise_alert(db, "handover_unsigned", "warn", f"Bàn giao {h.code} chưa được bếp trưởng ký nhận",
                           "Chưa ký nhận thì tồn chưa chuyển sang Bếp; bếp đang dùng hàng chưa bàn giao?",
                           shift_id=h.shift_id, ref=("handover", h.id), dedupe=f"handover_unsigned:{h.id}")

    grace = timedelta(minutes=int(get_setting(db, "return_grace_minutes")))
    for s in db.scalars(select(Shift).where(Shift.status == "open", Shift.planned_end < now - grace)):
        alerts.raise_alert(db, "shift_not_returned", "critical", f"{s.name} {s.business_date:%d/%m} đã kết thúc mà chưa cân trả",
                           "Thủ kho cần cân phần bếp trả để chốt chênh lệch của ca.",
                           shift_id=s.id, ref=("shift", s.id), dedupe=f"not_returned:{s.id}")
    for s in db.scalars(select(Shift).where(Shift.status == "planned", Shift.planned_start < now - grace,
                                            Shift.planned_end > now)):
        alerts.raise_alert(db, "no_handover", "warn", f"{s.name} {s.business_date:%d/%m} chưa nhận bàn giao đầu ca",
                           "Ca đã bắt đầu nhưng chưa có phiếu bàn giao nhóm A được ký nhận.",
                           shift_id=s.id, ref=("shift", s.id), dedupe=f"no_handover:{s.id}")

    last_end = max((s.planned_end for s in shifts.ensure_shifts(db, today)), default=None)
    if last_end and now > last_end + grace and not counted_a_today(db, today):
        alerts.raise_alert(db, "no_count", "warn", f"Nhóm A tại Kho chưa kiểm kê ngày {today:%d/%m}",
                           "Kiểm kê mù cuối ngày tại Kho là bắt buộc với hàng nhóm A.", dedupe=f"no_count:{today}")

    for inv in db.scalars(select(Investigation).where(Investigation.status == "open", Investigation.due_at < now)):
        ing = db.get(Ingredient, inv.ingredient_id)
        alerts.raise_alert(db, "investigation_overdue", "critical", f"Phiếu điều tra {inv.code} quá hạn xử lý",
                           f"{ing.name}: {fmt_money(inv.variance_value)}, hạn {clock.local(inv.due_at):%H:%M %d/%m}.",
                           ingredient_id=inv.ingredient_id, shift_id=inv.shift_id, ref=("investigation", inv.id),
                           dedupe=f"overdue:{inv.id}")

    _cancel_anomalies(db, today)
    db.flush()
    after = db.scalar(select(func.count()).select_from(alerts.Alert)) or 0
    return after - before


def counted_a_today(db: Session, day) -> bool:
    start, end = clock.day_bounds(day)
    a_ids = set(db.scalars(select(Ingredient.id).where(Ingredient.control_group == d.GROUP_A, Ingredient.active)))
    counted = set(db.scalars(
        select(CountLine.ingredient_id).join(CountSession, CountSession.id == CountLine.session_id)
        .where(CountSession.kind.in_([d.COUNT_PERIODIC, d.COUNT_SPOT]), CountLine.location == d.KHO,
               CountLine.cutoff_at >= start, CountLine.cutoff_at < end)
    ))
    return bool(a_ids) and a_ids <= counted


def _cancel_anomalies(db: Session, day) -> None:
    """Số lần hủy sau chế biến / làm lại bất thường theo món, ca hoặc nhân viên."""
    start, end = clock.day_bounds(day)
    minimum = int(get_setting(db, "cancel_anomaly_min"))

    def collect(a, b):
        rows = db.execute(
            select(OrderItem.menu_item_id, OrderItem.shift_id, OrderItem.ended_by)
            .where(OrderItem.status.in_([d.ITEM_CANCELLED, d.ITEM_REMADE]), OrderItem.started_at.is_not(None),
                   OrderItem.ended_at >= a, OrderItem.ended_at < b)
        ).all()
        return rows

    today_rows = collect(start, end)
    if not today_rows:
        return
    hist_rows = collect(start - timedelta(days=7), start)
    for idx, kind in ((0, "món"), (1, "ca"), (2, "nhân viên")):
        now_c = Counter(r[idx] for r in today_rows if r[idx])
        hist_c = Counter(r[idx] for r in hist_rows if r[idx])
        for key, n in now_c.items():
            avg = hist_c.get(key, 0) / 7
            if n >= max(minimum, 2 * avg + 1):
                label = _label(db, idx, key)
                alerts.raise_alert(
                    db, "cancel_anomaly", "warn", f"Hủy / làm lại bất thường theo {kind}: {label}",
                    f"Hôm nay {n} lần hủy sau chế biến hoặc làm lại (trung bình 7 ngày: {avg:.1f}/ngày).",
                    dedupe=f"cancel:{day}:{idx}:{key}",
                )


def _label(db: Session, idx: int, key: int) -> str:
    if idx == 0:
        return db.get(MenuItem, key).name
    if idx == 1:
        s = db.get(Shift, key)
        return f"{s.name} {s.business_date:%d/%m}"
    return db.get(User, key).full_name
