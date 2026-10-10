"""Báo hết món và báo hết nguyên liệu (5.8, BR-13, BR-15)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, domain as d, events
from app.errors import Invalid
from app.models import Ingredient, MenuItem, Order, OrderItem, User
from app.services import alerts, catalog, counts, ledger, shifts
from app.services.common import audit, get_or_404
from app.services.format import fmt_money, fmt_qty


def report_dish_out(db: Session, actor: User, mi: MenuItem, reason: str) -> dict:
    """Báo hết món: chỉ khóa bán, không tác động kho (AC-14)."""
    if not reason.strip():
        raise Invalid("Ghi lý do tạm ngưng món")
    catalog.lock_dish(db, actor, mi, f"Báo hết món: {reason}")
    return {"locked": [mi.id]}


def report_ingredient_out(db: Session, actor: User, ing: Ingredient) -> dict:
    """Bếp báo hết nguyên liệu nhóm A: khóa món, kiểm kê nhanh = 0 tại Bếp, chuyển món đang chờ."""
    if ing.control_group != d.GROUP_A:
        raise Invalid(f"{ing.name} thuộc nhóm C: không dùng báo hết nguyên liệu, hãy báo thủ kho")
    shift = shifts.kitchen_shift(db)
    book_before = ledger.book(db, ing.id, d.BEP)
    line = counts.quick_out(db, actor, ing, shift)

    locked = []
    for mi in catalog.dishes_using(db, ing.id):
        if catalog.lock_dish(db, actor, mi, f"Hết {ing.name}", ingredient_id=ing.id):
            locked.append(mi.id)

    moved = []
    for oi in db.scalars(select(OrderItem).where(OrderItem.status == d.ITEM_WAITING)):
        v = catalog.effective_version(db, oi.menu_item_id)
        if v and any(ln.ingredient_id == ing.id for ln in v.lines):
            oi.status = d.ITEM_OUT
            oi.ended_at = clock.now()
            oi.ended_by = actor.id
            oi.end_reason = f"Hết {ing.name}"
            order = db.get(Order, oi.order_id)
            moved.append({"item_id": oi.id, "table": order.table_label, "order_id": order.id})
            events.emit(db, events.SERVER, "out_of_stock", {
                "item_id": oi.id, "order_id": order.id, "table": order.table_label,
                "dish": db.get(MenuItem, oi.menu_item_id).name, "ingredient": ing.name,
            })

    if book_before > 0:
        # Trường hợp then chốt: sổ còn hàng nhưng bếp báo hết → luôn cảnh báo quản lý.
        alerts.raise_alert(
            db, "out_with_book", "critical", f"Bếp báo hết {ing.name} khi tồn sổ còn {fmt_qty(book_before, ing.base_unit)}",
            f"Chênh lệch {fmt_qty(line.variance_qty, ing.base_unit)} ({fmt_money(line.variance_value)}), "
            f"mức: {d.TIERS[line.tier]}.",
            ingredient_id=ing.id, location=d.BEP, shift_id=shift.id if shift else None, ref=("count_line", line.id),
        )
    # Kho còn tồn sổ thì gợi ý thủ kho bàn giao bổ sung; không gửi số lượng để giữ kiểm kê mù.
    suggest = ledger.book(db, ing.id, d.KHO) > 0
    if suggest:
        events.emit(db, events.STORE, "restock_suggestion", {"ingredient_id": ing.id, "ingredient": ing.name})
    audit(db, actor.id, "ingredient.out", "ingredient", ing.id,
          after={"book_before": book_before, "variance": line.variance_qty, "locked": locked, "moved": moved})
    events.emit(db, events.KITCHEN, "out_of_stock", {"ingredient_id": ing.id})
    # Không trả tồn sổ hay chênh lệch về thiết bị của bếp.
    return {
        "ingredient": ing.name,
        "locked_menu_items": locked,
        "moved_items": moved,
        "suggest_supplement": suggest,
    }
