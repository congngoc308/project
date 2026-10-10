"""Dashboard quản lý (5.10): tiền lệch, phiếu điều tra, tuân thủ quy trình, xu hướng."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.models import Alert, CountLine, Handover, Ingredient, Receipt, Shift, StockTxn, User, WasteSlip
from app.services import alerts, catalog, investigations, monitor, shifts
from app.services.common import money
from app.models import MenuItem


def build(db: Session, day: date | None = None) -> dict:
    now = clock.now()
    day = day or clock.business_date(now)
    start, end = clock.day_bounds(day)
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    ings = {i.id: i for i in db.scalars(select(Ingredient))}

    lines = db.scalars(select(CountLine).where(CountLine.cutoff_at >= start, CountLine.cutoff_at < end,
                                               CountLine.variance_qty.is_not(None))).all()
    by_ing: dict[int, list[Decimal]] = defaultdict(lambda: [Decimal(0), Decimal(0)])
    for ln in lines:
        by_ing[ln.ingredient_id][0] += ln.variance_value or 0
        by_ing[ln.ingredient_id][1] += ln.variance_qty
    top = sorted(
        ({"ingredient_id": i, "ingredient": ings[i].name, "unit": ings[i].base_unit, "value": money(v[0]),
          "qty": v[1]} for i, v in by_ing.items() if v[0] != 0),
        key=lambda r: -abs(r["value"]),
    )[:6]

    today_shifts = []
    for s in shifts.ensure_shifts(db, day):
        signed = db.scalar(select(func.count()).select_from(Handover).where(
            Handover.shift_id == s.id, Handover.status == "signed")) or 0
        pending = db.scalar(select(func.count()).select_from(Handover).where(
            Handover.shift_id == s.id, Handover.status == "pending")) or 0
        val = sum((ln.variance_value or 0 for ln in lines if ln.shift_id == s.id and ln.location == d.BEP), Decimal(0))
        late_return = s.status == "open" and now > s.planned_end
        today_shifts.append({
            "id": s.id, "name": s.name, "status": s.status, "planned_start": s.planned_start,
            "planned_end": s.planned_end, "head_chef": names.get(s.head_chef_id), "handover_signed": signed > 0,
            "handover_pending": pending, "returned": s.status == "closed", "late_return": late_return,
            "variance_value": money(val), "sod_violation": s.sod_violation,
        })

    sod_shifts = [
        {"id": s.id, "name": s.name, "business_date": s.business_date, "notes": s.sod_notes}
        for s in db.scalars(select(Shift).where(Shift.sod_violation, Shift.business_date > day - timedelta(days=7))
                            .order_by(Shift.business_date.desc()))
    ]

    w_start = start - timedelta(days=29)
    waste = db.execute(
        select(StockTxn.late, func.coalesce(func.sum(StockTxn.value), 0))
        .where(StockTxn.txn_type.in_(d.RECORDED_WASTE_TYPES), StockTxn.occurred_at >= w_start, StockTxn.occurred_at < end)
        .group_by(StockTxn.late)
    ).all()
    waste_map = {late: -Decimal(v) for late, v in waste}

    locked = [catalog.menu_dict(db, mi) for mi in db.scalars(select(MenuItem)) if catalog.active_locks(db, mi.id)]
    pending_receipts = db.scalar(select(func.count()).select_from(Receipt).where(Receipt.status == "pending_approval")) or 0
    pending_waste = db.scalar(select(func.count()).select_from(WasteSlip).where(
        WasteSlip.status.in_(["pending_chef", "pending_manager"]))) or 0
    open_alerts = [alerts.alert_dict(a) for a in db.scalars(
        select(Alert).where(Alert.status == "open").order_by(Alert.at.desc()).limit(30))]

    return {
        "day": day,
        "now": now,
        "unexplained_value": money(sum((ln.variance_value or 0 for ln in lines), Decimal(0))),
        "shortage_value": money(sum((ln.variance_value or 0 for ln in lines if ln.variance_value and ln.variance_value > 0), Decimal(0))),
        "counts_today": len(lines),
        "top_ingredients": top,
        "investigations": investigations.list_open_for_dashboard(db),
        "shifts": today_shifts,
        "a_counted_today": monitor.counted_a_today(db, day),
        "sod_shifts": sod_shifts,
        "waste_on_time": money(waste_map.get(False, 0)),
        "waste_late": money(waste_map.get(True, 0)),
        "locked_dishes": locked,
        "pending_receipts": pending_receipts,
        "pending_waste": pending_waste,
        "alerts": open_alerts,
        "trend": trend(db, day, 30),
    }


def trend(db: Session, day: date, days: int) -> dict:
    """Xu hướng chênh lệch theo ngày, theo nguyên liệu, theo ca và theo bếp trưởng ca."""
    start = clock.day_bounds(day - timedelta(days=days - 1))[0]
    end = clock.day_bounds(day)[1]
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    ings = {i.id: i for i in db.scalars(select(Ingredient))}
    shift_names = {s.id: s.name for s in db.scalars(select(Shift).where(Shift.business_date >= day - timedelta(days=days)))}
    lines = db.scalars(select(CountLine).where(CountLine.cutoff_at >= start, CountLine.cutoff_at < end,
                                               CountLine.variance_qty.is_not(None))).all()
    per_day_ing: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    totals_ing: dict[str, float] = defaultdict(float)
    by_shift: dict[str, float] = defaultdict(float)
    by_chef: dict[str, list[float]] = defaultdict(lambda: [0.0, 0])
    for ln in lines:
        v = float(ln.variance_value or 0)
        day_key = clock.business_date(ln.cutoff_at).isoformat()
        name = ings[ln.ingredient_id].name
        per_day_ing[day_key][name] += v
        totals_ing[name] += abs(v)
        if ln.shift_id and ln.location == d.BEP:
            by_shift[shift_names.get(ln.shift_id, "?")] += v
        if ln.responsible_user_id:
            by_chef[names.get(ln.responsible_user_id, "?")][0] += v
            by_chef[names.get(ln.responsible_user_id, "?")][1] += 1
    top = [n for n, _ in sorted(totals_ing.items(), key=lambda x: -x[1])[:4]]
    series = []
    for i in range(days):
        dk = (day - timedelta(days=days - 1 - i)).isoformat()
        row = {"day": dk, "total": round(sum(per_day_ing[dk].values()))}
        for n in top:
            row[n] = round(per_day_ing[dk].get(n, 0))
        series.append(row)
    return {
        "days": days,
        "ingredients": top,
        "series": series,
        "by_shift": [{"shift": k, "value": round(v)} for k, v in sorted(by_shift.items())],
        "by_chef": [{"chef": k, "value": round(v[0]), "periods": v[1]} for k, v in sorted(by_chef.items(), key=lambda x: -x[1][0])],
    }
