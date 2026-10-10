"""Phiếu nhập hàng (5.5): tồn Kho tăng ngay khi thủ kho xác nhận Đã nhận."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock, domain as d, events
from app.errors import Conflict, Forbidden, Invalid
from app.models import Ingredient, Receipt, ReceiptLine, StockTxn, User
from app.services import alerts, ledger
from app.services.format import fmt_num
from app.services.common import assign_code, audit, conversion_factor, dec, get_or_404, get_setting, q3


def create(db: Session, actor: User, supplier: str, order_date: date | None, lines: list[dict], note: str = "") -> Receipt:
    if not supplier.strip():
        raise Invalid("Nhập tên nhà cung cấp")
    if not lines:
        raise Invalid("Phiếu nhập chưa có nguyên liệu")
    r = Receipt(supplier=supplier.strip(), order_date=order_date, status="draft", created_by=actor.id, note=note,
                anomalies=[])
    assign_code(db, r, "PN")
    for ln in lines:
        ing = get_or_404(db, Ingredient, int(ln["ingredient_id"]), "Nguyên liệu")
        unit = ln.get("unit") or ing.purchase_unit
        if conversion_factor(db, ing, unit) is None:
            raise Invalid(f"Không quy đổi được '{unit}' sang {ing.base_unit} cho {ing.name}")
        db.add(ReceiptLine(
            receipt_id=r.id, ingredient_id=ing.id, unit=unit, ordered_qty=dec(ln["ordered_qty"]),
            unit_price=dec(ln.get("unit_price") or 0), expiry_date=ln.get("expiry_date"),
        ))
    db.flush()
    audit(db, actor.id, "receipt.create", "receipt", r.id, after={"supplier": supplier, "lines": lines})
    return r


def receive(db: Session, actor: User, r: Receipt, lines: list[dict], invoice_image: str | None = None) -> Receipt:
    """Ghi tồn Kho ngay, cập nhật đơn giá nhập gần nhất, phát hiện phiếu bất thường (AC-06)."""
    if r.status != "draft":
        raise Conflict("Phiếu đã được nhận hoặc đã hủy")
    by_id = {int(x["line_id"]): x for x in lines}
    now = clock.now()
    anomalies: list[str] = []
    price_tol = dec(get_setting(db, "receipt_price_tolerance_pct"))
    ratio_lim = dec(get_setting(db, "receipt_history_ratio"))
    rlines = db.scalars(select(ReceiptLine).where(ReceiptLine.receipt_id == r.id).order_by(ReceiptLine.id)).all()
    ledger.lock(db, [(ln.ingredient_id, d.KHO) for ln in rlines])
    for ln in rlines:
        ing = db.get(Ingredient, ln.ingredient_id)
        inp = by_id.get(ln.id)
        if inp is None:
            raise Invalid(f"Chưa nhập số nhận cho {ing.name}")
        received = q3(dec(inp["received_qty"]))
        if received < 0:
            raise Invalid("Số nhận không được âm")
        if "unit_price" in inp and inp["unit_price"] is not None:
            ln.unit_price = dec(inp["unit_price"])
        if inp.get("expiry_date"):
            ln.expiry_date = inp["expiry_date"]
        if received != ln.ordered_qty:
            reason = (inp.get("diff_reason") or "").strip()
            if not reason:
                raise Invalid(f"{ing.name}: số nhận khác số đặt, bắt buộc ghi lý do")
            ln.diff_reason = reason
            anomalies.append(f"{ing.name}: nhận {fmt_num(received)} khác đặt {fmt_num(ln.ordered_qty)} {ln.unit}")
        factor = conversion_factor(db, ing, ln.unit)
        base_qty = q3(received * factor)
        cost = (ln.unit_price / factor).quantize(Decimal("0.0001")) if factor else Decimal(0)
        old_cost = ing.last_unit_cost
        if old_cost and cost and abs(cost - old_cost) / old_cost * 100 > price_tol:
            anomalies.append(f"{ing.name}: đơn giá lệch {((cost - old_cost) / old_cost * 100):+.0f}% so với lần nhập trước")
        hist = dec(db.scalar(
            select(func.avg(ReceiptLine.received_qty_base))
            .where(ReceiptLine.ingredient_id == ing.id, ReceiptLine.received_qty_base > 0)
        ) or 0)
        if hist > 0 and base_qty > 0 and (base_qty / hist >= ratio_lim or hist / base_qty >= ratio_lim):
            anomalies.append(
                f"{ing.name}: số lượng {fmt_num(base_qty)} {ing.base_unit} lệch lớn so với trung bình {fmt_num(round(hist))} — "
                "có thể nhập nhầm đơn vị"
            )
        ln.received_qty = received
        ln.received_qty_base = base_qty
        ln.unit_cost_base = cost
        if cost:
            ing.last_unit_cost = cost
        if base_qty > 0:
            txn = ledger.post(
                db, txn_type=d.TXN_RECEIPT, ingredient=ing, location=d.KHO, qty=base_qty, actor_id=actor.id,
                source=("receipt", r.id), unit_cost=cost or ing.last_unit_cost, occurred_at=now,
            )
            ln.txn_id = txn.id
    r.received_at = now
    r.received_by = actor.id
    r.invoice_image = invoice_image or r.invoice_image
    r.anomalies = anomalies
    r.status = "pending_approval" if anomalies else "received"
    if anomalies:
        alerts.raise_alert(db, "receipt_pending", "warn", f"Phiếu nhập {r.code} chờ duyệt", "; ".join(anomalies),
                           ref=("receipt", r.id), dedupe=f"receipt:{r.id}")
    audit(db, actor.id, "receipt.receive", "receipt", r.id, after={"lines": lines, "anomalies": anomalies})
    events.emit(db, events.MANAGER, "receipt", {"id": r.id, "status": r.status})
    return r


def approve(db: Session, actor: User, r: Receipt, note: str = "") -> Receipt:
    if r.status != "pending_approval":
        raise Conflict("Phiếu không ở trạng thái chờ duyệt")
    if actor.id == r.received_by:
        raise Forbidden("Không được duyệt phiếu nhập do chính mình nhận")
    r.status = "approved"
    r.approved_by = actor.id
    r.approved_at = clock.now()
    alerts.resolve_by_key(db, f"receipt:{r.id}", actor.id)
    audit(db, actor.id, "receipt.approve", "receipt", r.id, note=note)
    return r


def cancel(db: Session, actor: User, r: Receipt, reason: str) -> Receipt:
    if r.status != "draft":
        raise Conflict("Phiếu đã nhận thì không hủy; sửa sai bằng điều chỉnh có liên kết")
    r.status = "cancelled"
    r.note = (r.note + f"\nHủy: {reason}").strip()
    audit(db, actor.id, "receipt.cancel", "receipt", r.id, note=reason)
    return r


def correct_line(db: Session, actor: User, ln: ReceiptLine, correct_qty, reason: str) -> StockTxn:
    """Sửa sai phiếu nhập đã ghi sổ: điều chỉnh có liên kết tới bản gốc, không sửa bản gốc (BR-02)."""
    if ln.txn_id is None:
        raise Conflict("Dòng phiếu chưa ghi sổ")
    if not reason.strip():
        raise Invalid("Ghi lý do điều chỉnh")
    ing = db.get(Ingredient, ln.ingredient_id)
    factor = conversion_factor(db, ing, ln.unit)
    corrected_base = q3(dec(correct_qty) * factor)
    already = dec(db.scalar(
        select(func.coalesce(func.sum(StockTxn.qty), 0)).where(
            StockTxn.ref_txn_id == ln.txn_id, StockTxn.txn_type == d.TXN_LINKED_ADJUSTMENT)
    ))
    delta = q3(corrected_base - (ln.received_qty_base + already))
    if delta == 0:
        raise Invalid("Số mới trùng số đang ghi sổ")
    txn = ledger.post(
        db, txn_type=d.TXN_LINKED_ADJUSTMENT, ingredient=ing, location=d.KHO, qty=delta, actor_id=actor.id,
        source=("receipt", ln.receipt_id), ref_txn_id=ln.txn_id, cause="nhap_sai",
        responsible_user_id=db.get(Receipt, ln.receipt_id).received_by, approved_by=actor.id,
        unit_cost=ln.unit_cost_base, note=reason,
    )
    audit(db, actor.id, "receipt.correct", "receipt_line", ln.id,
          before={"received_base": ln.received_qty_base + already}, after={"received_base": corrected_base}, note=reason)
    return txn


def receipt_dict(db: Session, r: Receipt) -> dict:
    users = {u.id: u.full_name for u in db.scalars(select(User).where(
        User.id.in_([x for x in (r.created_by, r.received_by, r.approved_by) if x])))}
    lines = []
    for ln in db.scalars(select(ReceiptLine).where(ReceiptLine.receipt_id == r.id).order_by(ReceiptLine.id)):
        ing = db.get(Ingredient, ln.ingredient_id)
        adj = dec(db.scalar(select(func.coalesce(func.sum(StockTxn.qty), 0)).where(
            StockTxn.ref_txn_id == ln.txn_id, StockTxn.txn_type == d.TXN_LINKED_ADJUSTMENT))) if ln.txn_id else 0
        lines.append({
            "id": ln.id, "ingredient_id": ing.id, "ingredient": ing.name, "base_unit": ing.base_unit,
            "unit": ln.unit, "ordered_qty": ln.ordered_qty, "received_qty": ln.received_qty,
            "unit_price": ln.unit_price, "expiry_date": ln.expiry_date, "diff_reason": ln.diff_reason,
            "received_qty_base": ln.received_qty_base, "unit_cost_base": ln.unit_cost_base,
            "linked_adjustment": adj,
        })
    return {
        "id": r.id, "code": r.code, "supplier": r.supplier, "order_date": r.order_date, "received_at": r.received_at,
        "status": r.status, "anomalies": r.anomalies, "invoice_image": r.invoice_image, "note": r.note,
        "created_by": users.get(r.created_by), "received_by": users.get(r.received_by),
        "approved_by": users.get(r.approved_by), "approved_at": r.approved_at, "lines": lines,
    }
