"""Đơn hàng và danh sách món của bếp ở mức tối thiểu (5.3) và trừ kho theo sự kiện (5.4)."""

from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app import clock, domain as d, events
from app.auth.security import verify_pin
from app.errors import Conflict, Forbidden, Invalid
from app.models import Ingredient, MenuItem, Order, OrderItem, StockTxn, User, WasteSlip
from app.services import alerts, catalog, ledger, shifts
from app.services.common import assign_code, audit, dec, get_or_404, q3
from app.services.format import fmt_qty

TERMINAL = {d.ITEM_DONE, d.ITEM_CANCELLED, d.ITEM_REMADE}


def _next_seq(db: Session) -> int:
    return int(db.scalar(text("SELECT nextval('kitchen_seq')")))


def location_of(ing: Ingredient) -> str:
    """Nhóm A trừ ở Bếp (đã qua bàn giao), nhóm C trừ trực tiếp ở Kho (2.2)."""
    return d.BEP if ing.control_group == d.GROUP_A else d.KHO


def create_order(db: Session, actor: User, table_label: str, items: list[dict], confirm: bool = True) -> Order:
    if not table_label.strip():
        raise Invalid("Chọn bàn hoặc 'Mang đi'")
    order = Order(table_label=table_label.strip(), status="draft", created_by=actor.id, opened_at=clock.now())
    assign_code(db, order, "DH")
    _add_items(db, order, items)
    audit(db, actor.id, "order.create", "order", order.id, after={"table": table_label, "items": items})
    if confirm:
        confirm_order(db, actor, order)
    return order


def _add_items(db: Session, order: Order, items: list[dict]) -> list[OrderItem]:
    if not items:
        raise Invalid("Đơn chưa có món")
    out = []
    for it in items:
        mi = get_or_404(db, MenuItem, int(it["menu_item_id"]), "Món")
        if not catalog.is_sellable(db, mi):
            raise Conflict(f"{mi.name} đang tạm hết, không nhận đơn")
        qty = int(it.get("qty", 1))
        if qty < 1:
            raise Invalid("Số lượng phải ≥ 1")
        oi = OrderItem(order_id=order.id, menu_item_id=mi.id, qty=qty, note=it.get("note", ""), status=d.ITEM_WAITING)
        db.add(oi)
        out.append(oi)
    db.flush()
    return out


def confirm_order(db: Session, actor: User, order: Order) -> Order:
    if order.status != "draft":
        raise Conflict("Đơn đã được xác nhận")
    order.status = "confirmed"
    order.confirmed_at = clock.now()
    for oi in db.scalars(select(OrderItem).where(OrderItem.order_id == order.id).order_by(OrderItem.id)):
        oi.seq = _next_seq(db)
    audit(db, actor.id, "order.confirm", "order", order.id)
    events.emit(db, events.KITCHEN, "order", {"order_id": order.id})
    return order


def add_items(db: Session, actor: User, order: Order, items: list[dict]) -> list[OrderItem]:
    if order.status not in ("draft", "confirmed"):
        raise Conflict("Đơn đã đóng")
    new = _add_items(db, order, items)
    if order.status == "confirmed":
        for oi in new:
            oi.seq = _next_seq(db)
    audit(db, actor.id, "order.add_items", "order", order.id, after={"items": items})
    events.emit(db, events.KITCHEN, "order", {"order_id": order.id})
    return new


def update_item(db: Session, actor: User, oi: OrderItem, qty: int | None, note: str | None) -> OrderItem:
    if oi.status != d.ITEM_WAITING:
        raise Conflict("Chỉ sửa được món chưa bắt đầu chế biến")
    before = {"qty": oi.qty, "note": oi.note}
    if qty is not None:
        if qty < 1:
            raise Invalid("Số lượng phải ≥ 1")
        oi.qty = qty
    if note is not None:
        oi.note = note
    audit(db, actor.id, "order_item.update", "order_item", oi.id, before=before, after={"qty": oi.qty, "note": oi.note})
    events.emit(db, events.KITCHEN, "order", {"order_id": oi.order_id})
    return oi


def start_item(db: Session, actor: User, oi: OrderItem) -> OrderItem:
    """Bắt đầu chế biến = nguyên liệu rời tồn: ghi tiêu hao theo công thức đang hiệu lực (BR-04)."""
    if oi.status != d.ITEM_WAITING:
        raise Conflict("Món không ở trạng thái Chờ bếp")
    order = db.get(Order, oi.order_id)
    if order.status != "confirmed":
        raise Conflict("Đơn chưa được xác nhận")
    now = clock.now()
    version = catalog.effective_version(db, oi.menu_item_id, now)
    if version is None:
        raise Invalid("Món chưa có công thức, không trừ kho được")
    shift = shifts.kitchen_shift(db, now)
    ings = {ln.ingredient_id: ln.ingredient for ln in version.lines}
    ledger.lock(db, [(i.id, location_of(i)) for i in ings.values()])
    for ln in version.lines:
        ing = ln.ingredient
        loc = location_of(ing)
        ledger.post(
            db, txn_type=d.TXN_CONSUMPTION, ingredient=ing, location=loc, qty=-(ln.issue_qty_base * oi.qty),
            actor_id=actor.id, shift_id=shift.id if (shift and loc == d.BEP) else None,
            source=("order_item", oi.id), occurred_at=now,
        )
        bal = ledger.book(db, ing.id, loc)
        if loc == d.BEP and bal < 0:
            alerts.raise_alert(
                db, "negative_book", "warn", f"Tồn sổ {ing.name} tại Bếp đang âm",
                f"Tồn sổ {fmt_qty(bal, ing.base_unit)} sau khi bắt đầu món. Có thể bếp dùng hàng chưa qua bàn giao.",
                ingredient_id=ing.id, location=loc, shift_id=shift.id if shift else None,
                dedupe=f"negative:{ing.id}:{loc}:{shift.id if shift else 0}",
            )
    oi.status = d.ITEM_COOKING
    oi.recipe_version_id = version.id
    oi.shift_id = shift.id if shift else None
    oi.started_at = now
    oi.started_by = actor.id
    audit(db, actor.id, "order_item.start", "order_item", oi.id, after={"recipe_version": version.version_no})
    events.emit(db, events.KITCHEN, "item", {"id": oi.id, "status": oi.status})
    return oi


def complete_item(db: Session, actor: User, oi: OrderItem) -> OrderItem:
    """Hoàn tất không tác động kho (AC-02)."""
    if oi.status != d.ITEM_COOKING:
        raise Conflict("Món chưa bắt đầu chế biến")
    oi.status = d.ITEM_DONE
    oi.done_at = clock.now()
    audit(db, actor.id, "order_item.done", "order_item", oi.id)
    _maybe_close_order(db, oi.order_id)
    events.emit(db, events.KITCHEN, "item", {"id": oi.id, "status": oi.status})
    order = db.get(Order, oi.order_id)
    events.emit(db, events.SERVER, "item", {"id": oi.id, "status": oi.status, "order_id": oi.order_id,
                                            "table": order.table_label, "dish": db.get(MenuItem, oi.menu_item_id).name, "qty": oi.qty})
    return oi


def serve_items(db: Session, actor: User, items: list[OrderItem]) -> list[OrderItem]:
    """Phục vụ xác nhận đã mang món ra bàn. Chỉ món đã hoàn tất, chưa bưng; không tác động kho."""
    if not items:
        raise Invalid("Chưa chọn món")
    for oi in items:
        if oi.status != d.ITEM_DONE:
            raise Conflict("Món chưa hoàn tất, chưa bưng được")
        if oi.served_at is not None:
            raise Conflict("Món đã được bưng ra rồi")
    now = clock.now()
    for oi in items:
        oi.served_at = now
        oi.served_by = actor.id
        audit(db, actor.id, "order_item.served", "order_item", oi.id)
    ids = [oi.id for oi in items]
    events.emit(db, events.KITCHEN, "item", {"ids": ids, "served": True})
    events.emit(db, events.SERVER, "item", {"ids": ids, "served": True})
    return items


def ready_to_serve(db: Session) -> list[dict]:
    """Món bếp đã hoàn tất nhưng phục vụ chưa bưng, cũ nhất trước."""
    stmt = (
        select(OrderItem).options(selectinload(OrderItem.order))
        .where(OrderItem.status == d.ITEM_DONE, OrderItem.served_at.is_(None))
        .order_by(OrderItem.done_at, OrderItem.id)
    )
    return [item_dict(db, oi) for oi in db.scalars(stmt)]


def _maybe_close_order(db: Session, order_id: int) -> None:
    order = db.get(Order, order_id)
    items = db.scalars(select(OrderItem).where(OrderItem.order_id == order_id)).all()
    if items and all(i.status in TERMINAL for i in items):
        order.status = "done"


def _consumption_txns(db: Session, oi: OrderItem) -> list[StockTxn]:
    return list(db.scalars(
        select(StockTxn).where(StockTxn.source_type == "order_item", StockTxn.source_id == oi.id,
                               StockTxn.txn_type == d.TXN_CONSUMPTION)
    ))


def _confirm_chef(db: Session, actor: User, chef_id: int | None, chef_pin: str | None) -> User:
    """Hủy / làm lại món đã bắt đầu phải qua bếp trưởng xác nhận bằng PIN (BR-03)."""
    if not actor.has(d.KITCHEN, d.HEAD_CHEF, d.MANAGER):
        raise Forbidden("Phục vụ không được hủy món đã bắt đầu chế biến")
    if not chef_id or not chef_pin:
        raise Invalid("Cần bếp trưởng xác nhận bằng PIN")
    chef = get_or_404(db, User, chef_id, "Người dùng")
    if not chef.has(d.HEAD_CHEF, d.MANAGER):
        raise Forbidden(f"{chef.full_name} không phải bếp trưởng")
    verify_pin(db, chef, chef_pin)
    return chef


def _convert_to_waste(
    db: Session, actor: User, chef: User, oi: OrderItem, waste_type: str, reason: str,
    used: dict[int, Decimal] | None,
) -> None:
    """Phần tiêu hao đã ghi chuyển thành hao hụt; phần khai dùng ít hơn được trả lại tồn."""
    txns = _consumption_txns(db, oi)
    ings = {t.ingredient_id: db.get(Ingredient, t.ingredient_id) for t in txns}
    ledger.lock(db, [(t.ingredient_id, t.location) for t in txns])
    now = clock.now()
    for t in txns:
        ing = ings[t.ingredient_id]
        full = -t.qty
        use = full if used is None else q3(dec(used.get(t.ingredient_id, full)))
        if use < 0 or use > full:
            raise Invalid(f"Lượng đã dùng {ing.name} phải từ 0 đến {fmt_qty(full, ing.base_unit)}")
        ledger.post(
            db, txn_type=d.TXN_CONSUMPTION_REVERSAL, ingredient=ing, location=t.location, qty=full,
            actor_id=actor.id, shift_id=t.shift_id, source=("order_item", oi.id), ref_txn_id=t.id,
            approved_by=chef.id, unit_cost=t.unit_cost, occurred_at=now,
        )
        if use > 0:
            slip = WasteSlip(
                at=now, ingredient_id=ing.id, location=t.location, qty=use, waste_type=waste_type, reason=reason,
                shift_id=t.shift_id, order_item_id=oi.id, status="approved", created_by=actor.id,
                approved_by=chef.id, approved_at=now,
            )
            db.add(slip)
            db.flush()
            wt = ledger.post(
                db, txn_type=d.TXN_WASTE, ingredient=ing, location=t.location, qty=-use, actor_id=actor.id,
                shift_id=t.shift_id, source=("waste_slip", slip.id), ref_txn_id=t.id, waste_type=waste_type,
                approved_by=chef.id, unit_cost=t.unit_cost, note=reason, occurred_at=now,
            )
            slip.txn_id = wt.id


def cancel_item(
    db: Session, actor: User, oi: OrderItem, reason: str, chef_id: int | None = None, chef_pin: str | None = None,
    used_mode: str = "full", used: dict[int, Decimal] | None = None,
) -> OrderItem:
    if not reason.strip():
        raise Invalid("Phải ghi lý do hủy")
    now = clock.now()
    if oi.status in (d.ITEM_WAITING, d.ITEM_OUT):
        # Hủy trước khi bắt đầu: không tác động kho (AC-03).
        before = oi.status
    elif oi.status in (d.ITEM_COOKING, d.ITEM_DONE):
        chef = _confirm_chef(db, actor, chef_id, chef_pin)
        if used_mode == "unknown":
            reason = f"Không xác định được lượng đã dùng: {reason}"
            used = None
        elif used_mode == "full":
            used = None
        elif used_mode != "partial":
            raise Invalid("Cách khai lượng đã dùng không hợp lệ")
        _convert_to_waste(db, actor, chef, oi, "khach_huy_sau_che_bien", reason, used)
        oi.confirmed_by = chef.id
        before = oi.status
    else:
        raise Conflict("Món đã kết thúc, không hủy được")
    oi.status = d.ITEM_CANCELLED
    oi.ended_at = now
    oi.ended_by = actor.id
    oi.end_reason = reason
    audit(db, actor.id, "order_item.cancel", "order_item", oi.id, before={"status": before},
          after={"status": oi.status, "reason": reason, "used_mode": used_mode, "used": used})
    _maybe_close_order(db, oi.order_id)
    events.emit(db, events.KITCHEN, "item", {"id": oi.id, "status": oi.status})
    order = db.get(Order, oi.order_id)
    events.emit(db, events.SERVER, "item", {"id": oi.id, "status": oi.status, "order_id": oi.order_id,
                                            "table": order.table_label, "dish": db.get(MenuItem, oi.menu_item_id).name, "qty": oi.qty})
    return oi


def serve_items(db: Session, actor: User, items: list[OrderItem]) -> list[OrderItem]:
    """Phục vụ xác nhận đã mang món ra bàn. Chỉ món đã hoàn tất, chưa bưng; không tác động kho."""
    if not items:
        raise Invalid("Chưa chọn món")
    for oi in items:
        if oi.status != d.ITEM_DONE:
            raise Conflict("Món chưa hoàn tất, chưa bưng được")
        if oi.served_at is not None:
            raise Conflict("Món đã được bưng ra rồi")
    now = clock.now()
    for oi in items:
        oi.served_at = now
        oi.served_by = actor.id
        audit(db, actor.id, "order_item.served", "order_item", oi.id)
    ids = [oi.id for oi in items]
    events.emit(db, events.KITCHEN, "item", {"ids": ids, "served": True})
    events.emit(db, events.SERVER, "item", {"ids": ids, "served": True})
    return items


def ready_to_serve(db: Session) -> list[dict]:
    """Món bếp đã hoàn tất nhưng phục vụ chưa bưng, cũ nhất trước."""
    stmt = (
        select(OrderItem).options(selectinload(OrderItem.order))
        .where(OrderItem.status == d.ITEM_DONE, OrderItem.served_at.is_(None))
        .order_by(OrderItem.done_at, OrderItem.id)
    )
    return [item_dict(db, oi) for oi in db.scalars(stmt)]


def remake_item(db: Session, actor: User, oi: OrderItem, reason: str, chef_id: int | None, chef_pin: str | None) -> OrderItem:
    """Làm lại: tiêu hao của món gốc chuyển thành hao hụt 'làm lại'; món mới tiêu hao bình thường."""
    if oi.status not in (d.ITEM_COOKING, d.ITEM_DONE):
        raise Conflict("Chỉ làm lại được món đã bắt đầu chế biến")
    if not reason.strip():
        raise Invalid("Phải ghi lý do làm lại")
    chef = _confirm_chef(db, actor, chef_id, chef_pin)
    _convert_to_waste(db, actor, chef, oi, "lam_lai", reason, None)
    now = clock.now()
    oi.status = d.ITEM_REMADE
    oi.ended_at = now
    oi.ended_by = actor.id
    oi.end_reason = reason
    oi.confirmed_by = chef.id
    new = OrderItem(order_id=oi.order_id, menu_item_id=oi.menu_item_id, qty=oi.qty, note=oi.note,
                    status=d.ITEM_WAITING, seq=oi.seq, remake_of_id=oi.id)
    db.add(new)
    db.flush()
    audit(db, actor.id, "order_item.remake", "order_item", oi.id, after={"reason": reason, "new_item": new.id})
    events.emit(db, events.KITCHEN, "item", {"id": oi.id, "status": oi.status})
    return new


def kitchen_list(db: Session, include_done_minutes: int = 30) -> list[dict]:
    """Danh sách món theo thứ tự xác nhận (AC-01)."""
    now = clock.now()
    stmt = (
        select(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .options(selectinload(OrderItem.order))
        .where(Order.status.in_(["confirmed", "done"]))
        .where(
            OrderItem.status.in_([d.ITEM_WAITING, d.ITEM_COOKING, d.ITEM_OUT])
            | ((OrderItem.status == d.ITEM_DONE) & (OrderItem.done_at > now - _minutes(include_done_minutes)))
        )
        .order_by(OrderItem.seq, OrderItem.id)
    )
    return [item_dict(db, oi) for oi in db.scalars(stmt)]


def _minutes(n: int):
    from datetime import timedelta

    return timedelta(minutes=n)


def item_dict(db: Session, oi: OrderItem) -> dict:
    mi = db.get(MenuItem, oi.menu_item_id)
    return {
        "id": oi.id,
        "order_id": oi.order_id,
        "order_code": oi.order.code,
        "table": oi.order.table_label,
        "menu_item_id": mi.id,
        "name": mi.name,
        "qty": oi.qty,
        "note": oi.note,
        "status": oi.status,
        "seq": oi.seq,
        "started_at": oi.started_at,
        "done_at": oi.done_at,
        "ended_at": oi.ended_at,
        "end_reason": oi.end_reason,
        "remake_of_id": oi.remake_of_id,
        "confirmed_at": oi.order.confirmed_at,
        "served_at": oi.served_at,
    }


def order_dict(db: Session, order: Order) -> dict:
    return {
        "id": order.id,
        "code": order.code,
        "table": order.table_label,
        "status": order.status,
        "opened_at": order.opened_at,
        "confirmed_at": order.confirmed_at,
        "created_by": order.created_by,
        "items": [item_dict(db, oi) for oi in db.scalars(
            select(OrderItem).options(selectinload(OrderItem.order)).where(OrderItem.order_id == order.id)
            .order_by(OrderItem.id)
        )],
    }
