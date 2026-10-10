"""Tính chênh lệch tại mỗi lần kiểm kê và xử lý theo ngưỡng hai tầng (mục 2, 2.4, 5.7).

Chênh lệch chưa giải thích = tồn sổ tại thời điểm chốt − tồn kiểm kê (dương = thiếu). Tồn sổ đã
trừ sẵn tiêu hao lý thuyết và hao hụt đã ghi, nên công thức này tương đương
thực tế − lý thuyết − hao hụt đã ghi. Kỳ đo là từ lần kiểm kê trước của cùng nguyên liệu tại
cùng vị trí đến thời điểm chốt.
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import domain as d
from app.models import CountLine, CountSession, Ingredient, Shift, User
from app.services import alerts, ledger
from app.services.common import dec, get_setting, money, q3
from app.services.format import fmt_money, fmt_qty


def thresholds_for(db: Session, ing: Ingredient) -> dict[str, Decimal]:
    base = get_setting(db, "thresholds")[ing.control_group]
    out = {k: dec(v) for k, v in base.items()}
    for k in ("warn_pct", "warn_abs", "must_pct", "must_abs"):
        override = getattr(ing, k)
        if override is not None:
            out[k] = dec(override)
    return out


def classify(variance: Decimal, theoretical: Decimal, th: dict[str, Decimal]) -> tuple[str, Decimal | None]:
    """Chỉ coi là vượt khi vượt cả ngưỡng % và mức tối thiểu tuyệt đối.
    Kỳ không có món bán (lý thuyết = 0) thì chỉ xét ngưỡng tuyệt đối."""
    v = abs(variance)
    pct = (v / theoretical * 100).quantize(Decimal("0.01")) if theoretical > 0 else None

    def over(pct_key: str, abs_key: str) -> bool:
        return v > th[abs_key] and (pct is None or pct > th[pct_key])

    if over("must_pct", "must_abs"):
        tier = d.TIER_MUST
    elif over("warn_pct", "warn_abs"):
        tier = d.TIER_WARN
    else:
        tier = d.TIER_OK
    signed_pct = None if pct is None else (pct if variance >= 0 else -pct)
    return tier, signed_pct


def previous_cutoff(db: Session, ingredient_id: int, location: str, before) -> object:
    return db.scalar(
        select(CountLine.cutoff_at)
        .where(
            CountLine.ingredient_id == ingredient_id,
            CountLine.location == location,
            CountLine.cutoff_at.is_not(None),
            CountLine.cutoff_at < before,
        )
        .order_by(CountLine.cutoff_at.desc())
        .limit(1)
    )


def evaluate(
    db: Session,
    session: CountSession,
    ing: Ingredient,
    counted: Decimal,
    actor_id: int,
    line: CountLine | None = None,
) -> CountLine:
    """Chốt một dòng kiểm kê: ghi điều chỉnh hoặc chênh lệch chờ giải trình, mở điều tra nếu cần."""
    from app.services import investigations

    loc = session.location
    cutoff = session.cutoff_at
    counted = q3(dec(counted))
    if counted < 0:
        raise ValueError("Số đếm không được âm")
    bal = ledger.lock(db, [(ing.id, loc)])[(ing.id, loc)]
    book = q3(bal.qty)
    period_start = previous_cutoff(db, ing.id, loc, cutoff)
    theoretical = -ledger.sum_qty(db, ing.id, loc, d.THEORETICAL_TYPES, period_start, cutoff)
    waste = -ledger.sum_qty(db, ing.id, loc, d.RECORDED_WASTE_TYPES, period_start, cutoff, late=False)
    variance = q3(book - counted)
    tier, pct = classify(variance, theoretical, thresholds_for(db, ing))

    shift = db.get(Shift, session.shift_id) if session.shift_id else None
    responsible = shift.head_chef_id if (shift and loc == d.BEP) else None

    if line is None:
        line = CountLine(session_id=session.id, ingredient_id=ing.id, location=loc)
        db.add(line)
    line.shift_id = session.shift_id
    line.counted_qty = counted
    line.cutoff_at = cutoff
    line.period_start = period_start
    line.book_qty = book
    line.theoretical_qty = q3(theoretical)
    line.recorded_waste_qty = q3(waste)
    line.variance_qty = variance
    line.variance_pct = pct
    line.unit_cost = ing.last_unit_cost
    line.variance_value = money(variance * ing.last_unit_cost)
    line.tier = tier if variance != 0 else d.TIER_OK
    line.responsible_user_id = responsible
    db.flush()

    if variance != 0:
        txn_type = d.TXN_PENDING_VARIANCE if tier == d.TIER_MUST else d.TXN_COUNT_ADJUSTMENT
        txn = ledger.post(
            db,
            txn_type=txn_type,
            ingredient=ing,
            location=loc,
            qty=counted - book,
            actor_id=actor_id,
            shift_id=session.shift_id,
            source=("count_line", line.id),
            responsible_user_id=responsible,
            approved_by=None if tier == d.TIER_MUST else actor_id,
            occurred_at=cutoff,
            note=d.COUNT_KINDS.get(session.kind),
        )
        line.txn_id = txn.id

    where = f"{ing.name} tại {d.LOCATIONS[loc]}" + (f", {shift.name} {shift.business_date:%d/%m}" if shift else "")
    detail = (
        f"Lệch {fmt_qty(variance, ing.base_unit)}"
        + (f" ({pct}% so với lý thuyết {fmt_qty(theoretical, ing.base_unit)})" if pct is not None else "")
        + f", {fmt_money(line.variance_value)}"
    )
    if line.tier == d.TIER_MUST:
        inv = investigations.open_for_line(db, line, session, ing)
        alerts.raise_alert(
            db, "variance_must", "critical", f"Chênh lệch bắt buộc giải trình: {where}", detail,
            ingredient_id=ing.id, location=loc, shift_id=session.shift_id, ref=("investigation", inv.id),
        )
    elif line.tier == d.TIER_WARN:
        alerts.raise_alert(
            db, "variance_warn", "warn", f"Chênh lệch mức cảnh báo: {where}", detail + ". Gợi ý kiểm tra.",
            ingredient_id=ing.id, location=loc, shift_id=session.shift_id, ref=("count_line", line.id),
        )
    check_trend(db, ing, loc)
    return line


def check_trend(db: Session, ing: Ingredient, loc: str) -> None:
    """Chênh lệch cùng chiều lặp lại N kỳ liên tiếp, kể cả khi từng kỳ vẫn trong ngưỡng."""
    n = int(get_setting(db, "trend_periods"))
    lines = db.scalars(
        select(CountLine)
        .where(CountLine.ingredient_id == ing.id, CountLine.location == loc, CountLine.variance_qty.is_not(None))
        .order_by(CountLine.cutoff_at.desc(), CountLine.id.desc())
        .limit(n)
    ).all()
    if len(lines) < n:
        return
    if all(line.variance_qty > 0 for line in lines):
        direction = "thiếu"
    elif all(line.variance_qty < 0 for line in lines):
        direction = "thừa"
    else:
        return
    total = sum((line.variance_qty for line in lines), Decimal(0))
    value = sum((line.variance_value or 0 for line in lines), Decimal(0))
    names = {
        u.id: u.full_name
        for u in db.scalars(select(User).where(User.id.in_([x.responsible_user_id for x in lines if x.responsible_user_id])))
    }
    people = ", ".join(sorted({names[x.responsible_user_id] for x in lines if x.responsible_user_id in names}))
    alerts.raise_alert(
        db,
        "trend",
        "warn",
        f"Xu hướng: {ing.name} {direction} {n} kỳ liên tiếp tại {d.LOCATIONS[loc]}",
        f"Tổng {fmt_qty(abs(total), ing.base_unit)} ({fmt_money(abs(value))})"
        + (f". Phụ trách: {people}" if people else "")
        + ". Thất thoát đều đặn thường nằm dưới ngưỡng của từng ca.",
        ingredient_id=ing.id,
        location=loc,
        ref=("count_line", lines[0].id),
        dedupe=f"trend:{ing.id}:{loc}",
    )
