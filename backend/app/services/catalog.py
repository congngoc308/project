"""Món, công thức có phiên bản (5.1) và khóa bán món (5.8)."""

from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import clock, domain as d, events
from app.errors import Conflict, Invalid
from app.models import (
    CountLine,
    Handover,
    HandoverLine,
    Ingredient,
    MenuItem,
    MenuLock,
    Receipt,
    ReceiptLine,
    RecipeLine,
    RecipeVersion,
    User,
)
from app.services.common import audit, conversion_factor, dec, get_or_404, q3, to_base


def compute_issue(db: Session, ing: Ingredient, qty, unit: str, prep_loss_pct) -> tuple[Decimal, Decimal]:
    """Lượng xuất kho một phần = lượng tinh ÷ (1 − tỷ lệ hao hụt sơ chế) (BR-05, AC-05)."""
    net = to_base(db, ing, qty, unit)
    loss = dec(prep_loss_pct or 0)
    if not (0 <= loss < 100):
        raise Invalid("Tỷ lệ hao hụt sơ chế phải từ 0 đến dưới 100%")
    if net <= 0:
        raise Invalid("Định lượng phải lớn hơn 0")
    return net, q3(net / (1 - loss / 100))


def conversion_missing(db: Session, ing: Ingredient) -> bool:
    """Cảnh báo khi đơn vị mua không quy đổi được sang đơn vị kho (5.1)."""
    return conversion_factor(db, ing, ing.purchase_unit) is None


def effective_version(db: Session, menu_item_id: int, at: datetime | None = None) -> RecipeVersion | None:
    at = at or clock.now()
    return db.scalars(
        select(RecipeVersion)
        .options(selectinload(RecipeVersion.lines).selectinload(RecipeLine.ingredient))
        .where(RecipeVersion.menu_item_id == menu_item_id, RecipeVersion.effective_from <= at)
        .order_by(RecipeVersion.effective_from.desc(), RecipeVersion.version_no.desc())
        .limit(1)
    ).first()


def create_version(
    db: Session,
    actor: User,
    menu_item: MenuItem,
    lines: list[dict],
    reason: str,
    effective_from: datetime | None = None,
) -> RecipeVersion:
    """Sửa công thức = tạo phiên bản mới có ngày hiệu lực; không sửa lịch sử (BR-06)."""
    now = clock.now()
    eff = effective_from or now
    if eff < now - timedelta(minutes=1):
        raise Invalid("Ngày hiệu lực không được ở quá khứ: dữ liệu đã bán phải giữ nguyên công thức cũ")
    last_no = db.scalar(select(func.max(RecipeVersion.version_no)).where(RecipeVersion.menu_item_id == menu_item.id))
    if last_no and not reason.strip():
        raise Invalid("Phải ghi lý do sửa công thức (công thức sai là một nguyên nhân chênh lệch)")
    if not lines:
        raise Invalid("Công thức phải có ít nhất một nguyên liệu")
    seen = set()
    version = RecipeVersion(
        menu_item_id=menu_item.id, version_no=(last_no or 0) + 1, effective_from=eff,
        reason=reason.strip(), created_by=actor.id,
    )
    for ln in lines:
        ing = get_or_404(db, Ingredient, int(ln["ingredient_id"]), "Nguyên liệu")
        if ing.id in seen:
            raise Invalid(f"{ing.name} bị lặp trong công thức")
        seen.add(ing.id)
        net, issue = compute_issue(db, ing, ln["qty"], ln.get("unit") or ing.base_unit, ln.get("prep_loss_pct", 0))
        version.lines.append(RecipeLine(
            ingredient_id=ing.id, qty=dec(ln["qty"]), unit=ln.get("unit") or ing.base_unit,
            prep_loss_pct=dec(ln.get("prep_loss_pct") or 0), note=ln.get("note", ""),
            net_qty_base=net, issue_qty_base=issue,
        ))
    db.add(version)
    db.flush()
    audit(db, actor.id, "recipe.version", "menu_item", menu_item.id,
          after={"version": version.version_no, "effective_from": eff, "reason": reason, "lines": lines})
    return version


def version_dict(v: RecipeVersion) -> dict:
    return {
        "id": v.id,
        "version_no": v.version_no,
        "effective_from": v.effective_from,
        "reason": v.reason,
        "created_by": v.created_by,
        "created_at": v.created_at,
        "lines": [
            {
                "ingredient_id": ln.ingredient_id,
                "ingredient": ln.ingredient.name,
                "group": ln.ingredient.control_group,
                "base_unit": ln.ingredient.base_unit,
                "qty": ln.qty,
                "unit": ln.unit,
                "prep_loss_pct": ln.prep_loss_pct,
                "note": ln.note,
                "net_qty_base": ln.net_qty_base,
                "issue_qty_base": ln.issue_qty_base,
                "unit_cost": ln.ingredient.last_unit_cost,
                "cost": q3(ln.issue_qty_base * ln.ingredient.last_unit_cost),
            }
            for ln in v.lines
        ],
    }


# ---- Khóa bán món ----

def active_locks(db: Session, menu_item_id: int | None = None) -> list[MenuLock]:
    stmt = select(MenuLock).where(MenuLock.released_at.is_(None))
    if menu_item_id is not None:
        stmt = stmt.where(MenuLock.menu_item_id == menu_item_id)
    return list(db.scalars(stmt.order_by(MenuLock.locked_at)))


def is_sellable(db: Session, mi: MenuItem) -> bool:
    return mi.status == "selling" and not active_locks(db, mi.id)


def dishes_using(db: Session, ingredient_id: int) -> list[MenuItem]:
    out = []
    for mi in db.scalars(select(MenuItem).where(MenuItem.status == "selling")):
        v = effective_version(db, mi.id)
        if v and any(ln.ingredient_id == ingredient_id for ln in v.lines):
            out.append(mi)
    return out


def lock_dish(db: Session, actor: User, mi: MenuItem, reason: str, ingredient_id: int | None = None) -> MenuLock | None:
    for lk in active_locks(db, mi.id):
        if lk.ingredient_id == ingredient_id:
            return None
    lk = MenuLock(menu_item_id=mi.id, ingredient_id=ingredient_id, reason=reason, locked_at=clock.now(), locked_by=actor.id)
    db.add(lk)
    db.flush()
    audit(db, actor.id, "menu.lock", "menu_item", mi.id, after={"reason": reason, "ingredient_id": ingredient_id})
    events.emit(db, events.SERVER, "menu", {"menu_item_id": mi.id, "locked": True})
    events.emit(db, events.KITCHEN, "menu", {"menu_item_id": mi.id, "locked": True})
    return lk


def ingredient_restocked_since(db: Session, ingredient_id: int, since: datetime) -> str | None:
    """Bằng chứng nguyên liệu đã có lại: bàn giao bổ sung, phiếu nhập hoặc kiểm kê có hàng (5.8)."""
    h = db.scalar(
        select(Handover.code).join(HandoverLine, HandoverLine.handover_id == Handover.id)
        .where(HandoverLine.ingredient_id == ingredient_id, Handover.status == "signed", Handover.signed_at > since)
        .limit(1)
    )
    if h:
        return f"bàn giao {h}"
    r = db.scalar(
        select(Receipt.code).join(ReceiptLine, ReceiptLine.receipt_id == Receipt.id)
        .where(ReceiptLine.ingredient_id == ingredient_id, Receipt.received_at > since, ReceiptLine.received_qty > 0)
        .limit(1)
    )
    if r:
        return f"phiếu nhập {r}"
    c = db.scalar(
        select(CountLine.id).where(CountLine.ingredient_id == ingredient_id, CountLine.location == d.BEP,
                                   CountLine.cutoff_at > since, CountLine.counted_qty > 0).limit(1)
    )
    if c:
        return "kiểm kê đột xuất có hàng"
    from app.models import Investigation

    for inv in db.scalars(select(Investigation).where(Investigation.ingredient_id == ingredient_id,
                                                      Investigation.opened_at >= since - timedelta(minutes=1))):
        if any(a["cause"] == "bao_het_nham" and a["qty"] > 0 for a in inv.allocations):
            return f"kiểm kê xác nhận phiếu {inv.code}"
    return None


def resell(db: Session, actor: User, mi: MenuItem, note: str = "") -> list[MenuLock]:
    """Bán lại: chỉ bếp trưởng hoặc quản lý; khóa do hết nguyên liệu cần bằng chứng đã có hàng."""
    locks = active_locks(db, mi.id)
    if not locks:
        raise Conflict(f"{mi.name} không bị khóa")
    for lk in locks:
        if lk.ingredient_id:
            proof = ingredient_restocked_since(db, lk.ingredient_id, lk.locked_at)
            if proof is None:
                ing = db.get(Ingredient, lk.ingredient_id)
                raise Conflict(
                    f"Chưa có bàn giao bổ sung, phiếu nhập hoặc kiểm kê đột xuất xác nhận {ing.name} đã có lại"
                )
            lk.release_note = f"{note} ({proof})".strip()
        else:
            lk.release_note = note
        lk.released_at = clock.now()
        lk.released_by = actor.id
    audit(db, actor.id, "menu.resell", "menu_item", mi.id, note=note)
    events.emit(db, events.SERVER, "menu", {"menu_item_id": mi.id, "locked": False})
    events.emit(db, events.KITCHEN, "menu", {"menu_item_id": mi.id, "locked": False})
    return locks


def menu_dict(db: Session, mi: MenuItem, with_recipe: bool = False) -> dict:
    locks = active_locks(db, mi.id)
    out = {
        "id": mi.id,
        "code": mi.code,
        "name": mi.name,
        "category": mi.category,
        "price": mi.price,
        "status": mi.status,
        "locked": bool(locks),
        "locks": [
            {"id": lk.id, "reason": lk.reason, "ingredient_id": lk.ingredient_id, "locked_at": lk.locked_at}
            for lk in locks
        ],
        "sellable": mi.status == "selling" and not locks,
    }
    if with_recipe:
        v = effective_version(db, mi.id)
        out["recipe"] = version_dict(v) if v else None
    return out
