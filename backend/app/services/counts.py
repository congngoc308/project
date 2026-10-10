"""Kiểm kê (5.7): cân trả cuối ca, kiểm kê định kỳ, đột xuất, kiểm kê nhanh khi báo hết.

Màn đếm không bao giờ nhận tồn sổ (kiểm kê mù, BR-07, AC-08): session_dict chỉ trả tồn sổ
và chênh lệch cho quản lý, và chỉ sau khi phiên đã chốt.
"""

import random
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import clock, domain as d, events
from app.errors import Conflict, Forbidden, Invalid
from app.models import CountLine, CountSession, Handover, Ingredient, OrderItem, Shift, StockTxn, User
from app.services import alerts, ledger, shifts, variance
from app.services.common import assign_code, audit, dec, get_or_404, q3, to_base


def _check_counter(db: Session, actor: User, location: str, shift: Shift | None) -> None:
    """Người dùng nguyên liệu không tự đếm nguyên liệu đó. Kiêm nhiệm thì cho phép nhưng đánh dấu ca."""
    if not actor.has(d.STOREKEEPER, d.MANAGER):
        raise Forbidden("Chỉ thủ kho hoặc quản lý được nhập số kiểm kê / cân trả")
    if location != d.BEP or shift is None:
        return
    if shift.head_chef_id == actor.id:
        raise Forbidden("Bếp trưởng đã ký nhận ca này không được tự nhập số cân trả / kiểm kê tại Bếp")
    cooked = db.scalar(select(OrderItem.id).where(OrderItem.shift_id == shift.id, OrderItem.started_by == actor.id).limit(1))
    signed = db.scalar(select(Handover.id).where(Handover.shift_id == shift.id, Handover.received_by == actor.id).limit(1))
    if cooked or signed:
        shifts.mark_sod(shift, f"{actor.full_name} vừa chế biến/nhận hàng vừa nhập số kiểm kê tại Bếp")


def _new_session(db: Session, actor: User, kind: str, location: str, shift: Shift | None, note: str = "") -> CountSession:
    s = CountSession(kind=kind, location=location, shift_id=shift.id if shift else None, status="open",
                     blind=True, opened_at=clock.now(), created_by=actor.id, note=note)
    assign_code(db, s, "KK")
    return s


def _lock_session(s: CountSession, actor: User) -> None:
    s.status = "locked"
    s.counted_by = actor.id


# ---- Cân trả cuối ca (nhóm A tại Bếp) ----

def return_ingredients(db: Session, shift: Shift) -> list[Ingredient]:
    """Nguyên liệu nhóm A phải cân trả: còn tồn sổ ở Bếp hoặc có phát sinh trong ca."""
    ids = set(db.scalars(select(StockTxn.ingredient_id).where(StockTxn.shift_id == shift.id, StockTxn.location == d.BEP)))
    ids |= {i for (i, _), q in ledger.books(db, d.BEP).items() if q != 0}
    if not ids:
        return []
    return list(db.scalars(
        select(Ingredient).where(Ingredient.id.in_(ids), Ingredient.control_group == d.GROUP_A).order_by(Ingredient.name)
    ))


def submit_return(db: Session, actor: User, shift: Shift, counts: dict, note: str = "") -> CountSession:
    """Thủ kho cân phần bếp trả, bếp không thấy tồn sổ. Chênh lệch ca = tồn sổ Bếp − số cân trả."""
    if shift.status == "closed":
        raise Conflict("Ca này đã cân trả")
    _check_counter(db, actor, d.BEP, shift)
    ings = return_ingredients(db, shift)
    counts = {int(k): v for k, v in counts.items()}
    missing = [i.name for i in ings if i.id not in counts]
    if missing:
        raise Invalid("Chưa nhập số cân trả cho: " + ", ".join(missing))
    s = _new_session(db, actor, d.COUNT_SHIFT_RETURN, d.BEP, shift, note)
    s.cutoff_at = clock.now()
    ledger.lock(db, [(i.id, loc) for i in ings for loc in (d.KHO, d.BEP)])
    for ing in ings:
        counted = to_base(db, ing, counts[ing.id], ing.base_unit)
        variance.evaluate(db, s, ing, counted, actor.id)
        if counted > 0:
            common = dict(ingredient=ing, actor_id=actor.id, shift_id=shift.id, source=("count_session", s.id),
                          responsible_user_id=shift.head_chef_id, occurred_at=s.cutoff_at)
            ledger.post(db, txn_type=d.TXN_RETURN_OUT, location=d.BEP, qty=-counted, **common)
            ledger.post(db, txn_type=d.TXN_RETURN_IN, location=d.KHO, qty=counted, **common)
    _lock_session(s, actor)
    shift.status = "closed"
    shift.closed_at = s.cutoff_at
    alerts.resolve_by_key(db, f"not_returned:{shift.id}", actor.id)
    audit(db, actor.id, "shift.return", "shift", shift.id, after={"session": s.code, "counts": counts})
    events.emit(db, events.MANAGER, "count", {"session_id": s.id})
    events.emit(db, events.KITCHEN, "shift", {"id": shift.id, "status": shift.status})
    return s


# ---- Kiểm kê định kỳ / đột xuất ----

def create_session(
    db: Session, actor: User, kind: str, location: str, ingredient_ids: list[int] | None = None,
    group: str | None = None, random_n: int | None = None, note: str = "",
) -> CountSession:
    if kind not in (d.COUNT_PERIODIC, d.COUNT_SPOT):
        raise Invalid("Loại kiểm kê không hợp lệ")
    if kind == d.COUNT_SPOT and not actor.has(d.MANAGER):
        raise Forbidden("Chỉ quản lý được mở kiểm kê đột xuất")
    if kind == d.COUNT_PERIODIC and not actor.has(d.STOREKEEPER, d.MANAGER):
        raise Forbidden("Chỉ thủ kho hoặc quản lý được mở kiểm kê định kỳ")
    if location not in d.LOCATIONS:
        raise Invalid("Vị trí không hợp lệ")
    stmt = select(Ingredient).where(Ingredient.active)
    if location == d.BEP:
        stmt = stmt.where(Ingredient.control_group == d.GROUP_A)
    if ingredient_ids:
        stmt = stmt.where(Ingredient.id.in_(ingredient_ids))
    elif group:
        stmt = stmt.where(Ingredient.control_group == group)
    ings = list(db.scalars(stmt.order_by(Ingredient.name)))
    if random_n:
        pool = [i for i in ings if i.control_group == d.GROUP_A]
        ings = sorted(random.sample(pool, min(random_n, len(pool))), key=lambda i: i.name)
    if not ings:
        raise Invalid("Không có nguyên liệu nào để kiểm kê")
    shift = shifts.open_shift(db) if location == d.BEP else shifts.shift_at(db, clock.now())
    s = _new_session(db, actor, kind, location, shift, note)
    for ing in ings:
        db.add(CountLine(session_id=s.id, ingredient_id=ing.id, location=location))
    db.flush()
    audit(db, actor.id, "count.create", "count_session", s.id,
          after={"kind": kind, "location": location, "ingredients": [i.id for i in ings]})
    return s


def submit_session(db: Session, actor: User, s: CountSession, counts: dict) -> CountSession:
    if s.status != "open":
        raise Conflict("Phiên kiểm kê đã chốt; phát hiện sai thì tạo phiên điều chỉnh mới")
    shift = db.get(Shift, s.shift_id) if s.shift_id else None
    if s.location == d.BEP:
        shift = shifts.open_shift(db) or shift
        s.shift_id = shift.id if shift else None
    _check_counter(db, actor, s.location, shift)
    counts = {int(k): v for k, v in counts.items()}
    lines = db.scalars(select(CountLine).where(CountLine.session_id == s.id).order_by(CountLine.id)).all()
    missing = [db.get(Ingredient, ln.ingredient_id).name for ln in lines if ln.ingredient_id not in counts]
    if missing:
        raise Invalid("Chưa nhập số đếm cho: " + ", ".join(missing))
    s.cutoff_at = clock.now()
    ledger.lock(db, [(ln.ingredient_id, s.location) for ln in lines])
    for ln in lines:
        ing = db.get(Ingredient, ln.ingredient_id)
        variance.evaluate(db, s, ing, to_base(db, ing, counts[ing.id], ing.base_unit), actor.id, line=ln)
    _lock_session(s, actor)
    if s.kind == d.COUNT_PERIODIC and s.location == d.KHO:
        alerts.resolve_by_key(db, f"no_count:{clock.business_date(s.cutoff_at)}", actor.id)
    audit(db, actor.id, "count.submit", "count_session", s.id, after={"counts": counts})
    events.emit(db, events.MANAGER, "count", {"session_id": s.id})
    return s


def quick_out(db: Session, actor: User, ing: Ingredient, shift: Shift | None) -> CountLine:
    """Bếp bấm 'Hết nguyên liệu X': coi tồn thực tế của X tại Bếp = 0 và tính chênh lệch ngay."""
    s = _new_session(db, actor, d.COUNT_QUICK_OUT, d.BEP, shift, f"Bếp báo hết {ing.name}")
    s.cutoff_at = clock.now()
    s.blind = False
    line = variance.evaluate(db, s, ing, Decimal(0), actor.id)
    _lock_session(s, actor)
    return line


def review(db: Session, actor: User, s: CountSession) -> CountSession:
    """Quản lý duyệt kết quả kiểm kê định kỳ; thủ kho không duyệt phiên của chính mình."""
    if s.status != "locked":
        raise Conflict("Phiên chưa chốt")
    if actor.id == s.counted_by:
        raise Forbidden("Không được duyệt phiên kiểm kê do chính mình đếm")
    s.reviewed_by = actor.id
    s.reviewed_at = clock.now()
    audit(db, actor.id, "count.review", "count_session", s.id)
    return s


def create_correction(db: Session, actor: User, original: CountSession, note: str) -> CountSession:
    """Phiên đã khóa thì không sửa; tạo phiên điều chỉnh mới liên kết với phiên cũ."""
    if original.status != "locked":
        raise Conflict("Phiên gốc chưa chốt")
    if not note.strip():
        raise Invalid("Ghi rõ lý do tạo phiên điều chỉnh")
    ids = [ln.ingredient_id for ln in original.lines]
    kind = original.kind if original.kind in (d.COUNT_PERIODIC, d.COUNT_SPOT) else d.COUNT_SPOT
    if kind == d.COUNT_SPOT and not actor.has(d.MANAGER):
        kind = d.COUNT_PERIODIC
    s = create_session(db, actor, kind, original.location, ingredient_ids=ids, note=note)
    s.corrects_session_id = original.id
    return s


def session_dict(db: Session, s: CountSession, viewer: User) -> dict:
    reveal = viewer.has(d.MANAGER) and s.status == "locked"
    users = {u.id: u.full_name for u in db.scalars(
        select(User).where(User.id.in_([x for x in (s.created_by, s.counted_by, s.reviewed_by) if x])))}
    shift = db.get(Shift, s.shift_id) if s.shift_id else None
    lines = []
    for ln in db.scalars(select(CountLine).where(CountLine.session_id == s.id).order_by(CountLine.id)):
        ing = db.get(Ingredient, ln.ingredient_id)
        row = {"id": ln.id, "ingredient_id": ing.id, "ingredient": ing.name, "unit": ing.base_unit,
               "group": ing.control_group}
        if s.status == "locked":
            row["counted_qty"] = ln.counted_qty
        if reveal:
            row.update({
                "book_qty": ln.book_qty, "theoretical_qty": ln.theoretical_qty,
                "recorded_waste_qty": ln.recorded_waste_qty, "variance_qty": ln.variance_qty,
                "variance_pct": ln.variance_pct, "variance_value": ln.variance_value, "tier": ln.tier,
                "period_start": ln.period_start,
            })
        lines.append(row)
    return {
        "id": s.id, "code": s.code, "kind": s.kind, "kind_label": d.COUNT_KINDS.get(s.kind, s.kind),
        "location": s.location, "status": s.status, "opened_at": s.opened_at, "cutoff_at": s.cutoff_at,
        "shift": shifts.shift_dict(shift), "created_by": users.get(s.created_by), "counted_by": users.get(s.counted_by),
        "reviewed_by": users.get(s.reviewed_by), "reviewed_at": s.reviewed_at, "note": s.note,
        "corrects_session_id": s.corrects_session_id, "revealed": reveal, "lines": lines,
    }


def list_sessions(db: Session, status: str | None = None, kinds: list[str] | None = None, limit: int = 100):
    stmt = select(CountSession).order_by(CountSession.opened_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(CountSession.status == status)
    if kinds:
        stmt = stmt.where(or_(*[CountSession.kind == k for k in kinds]))
    return list(db.scalars(stmt))
