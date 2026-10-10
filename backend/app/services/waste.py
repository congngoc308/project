"""Phiếu hao hụt (5.6): ghi tại thời điểm xảy ra, có loại và lý do, duyệt theo hạn mức."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, domain as d, events
from app.errors import Conflict, Forbidden, Invalid
from app.models import Ingredient, User, WasteSlip
from app.services import ledger, shifts
from app.services.common import audit, to_base


def create(db: Session, actor: User, ing: Ingredient, qty, unit: str, waste_type: str, reason: str,
           location: str | None = None) -> WasteSlip:
    if waste_type not in d.MANUAL_WASTE_TYPES:
        raise Invalid("Loại hao hụt không hợp lệ")
    if waste_type == "khac" and not reason.strip():
        raise Invalid("Loại 'Khác' bắt buộc ghi chú")
    if ing.control_group == d.GROUP_C:
        location = d.KHO
    location = location or (d.KHO if actor.has(d.STOREKEEPER) and not actor.has(d.KITCHEN, d.HEAD_CHEF) else d.BEP)
    if location == d.BEP and not actor.has(d.KITCHEN, d.HEAD_CHEF, d.MANAGER):
        raise Forbidden("Chỉ bếp ghi hao hụt tại Bếp")
    if location == d.KHO and ing.control_group == d.GROUP_A and not actor.has(d.STOREKEEPER, d.MANAGER):
        raise Forbidden("Hao hụt nhóm A tại Kho do thủ kho ghi")
    base = to_base(db, ing, qty, unit or ing.base_unit)
    if base <= 0:
        raise Invalid("Lượng hao hụt phải lớn hơn 0")
    now = clock.now()
    shift = shifts.kitchen_shift(db, now) if location == d.BEP else shifts.shift_at(db, now)
    within = ing.waste_limit is None or base <= ing.waste_limit
    slip = WasteSlip(at=now, ingredient_id=ing.id, location=location, qty=base, waste_type=waste_type,
                     reason=reason.strip(), shift_id=shift.id if shift else None,
                     status="pending_chef" if within else "pending_manager", created_by=actor.id)
    db.add(slip)
    db.flush()
    txn = ledger.post(db, txn_type=d.TXN_WASTE, ingredient=ing, location=location, qty=-base, actor_id=actor.id,
                      shift_id=slip.shift_id, source=("waste_slip", slip.id), waste_type=waste_type,
                      note=reason, occurred_at=now)
    slip.txn_id = txn.id
    audit(db, actor.id, "waste.create", "waste_slip", slip.id,
          after={"ingredient": ing.name, "qty": base, "type": waste_type, "reason": reason, "status": slip.status})
    events.emit(db, events.MANAGER if not within else events.KITCHEN, "waste", {"id": slip.id})
    return slip


def _check_approver(actor: User, slip: WasteSlip) -> None:
    if actor.id == slip.created_by:
        raise Forbidden("Không được tự duyệt phiếu hao hụt của mình")
    if slip.status == "pending_chef" and not actor.has(d.HEAD_CHEF, d.MANAGER):
        raise Forbidden("Phiếu trong hạn mức do bếp trưởng hoặc quản lý duyệt")
    if slip.status == "pending_manager" and not actor.has(d.MANAGER):
        raise Forbidden("Phiếu vượt hạn mức phải do quản lý duyệt")


def approve(db: Session, actor: User, slip: WasteSlip) -> WasteSlip:
    if slip.status not in ("pending_chef", "pending_manager"):
        raise Conflict("Phiếu không chờ duyệt")
    _check_approver(actor, slip)
    slip.status = "approved"
    slip.approved_by = actor.id
    slip.approved_at = clock.now()
    audit(db, actor.id, "waste.approve", "waste_slip", slip.id)
    return slip


def reject(db: Session, actor: User, slip: WasteSlip, note: str) -> WasteSlip:
    """Từ chối: đảo giao dịch hao hụt bằng giao dịch mới, không xóa bản gốc."""
    if slip.status not in ("pending_chef", "pending_manager"):
        raise Conflict("Phiếu không chờ duyệt")
    _check_approver(actor, slip)
    if not note.strip():
        raise Invalid("Ghi lý do từ chối")
    ing = db.get(Ingredient, slip.ingredient_id)
    ledger.post(db, txn_type=d.TXN_WASTE_REVERSAL, ingredient=ing, location=slip.location, qty=slip.qty,
                actor_id=actor.id, shift_id=slip.shift_id, source=("waste_slip", slip.id), ref_txn_id=slip.txn_id,
                waste_type=slip.waste_type, approved_by=actor.id, note=note)
    slip.status = "rejected"
    slip.approved_by = actor.id
    slip.approved_at = clock.now()
    audit(db, actor.id, "waste.reject", "waste_slip", slip.id, note=note)
    return slip


def slip_dict(db: Session, s: WasteSlip) -> dict:
    ing = db.get(Ingredient, s.ingredient_id)
    names = {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_([s.created_by, s.approved_by or 0])))}
    group, label = d.WASTE_TYPES.get(s.waste_type, ("", s.waste_type))
    return {
        "id": s.id, "at": s.at, "ingredient_id": ing.id, "ingredient": ing.name, "unit": ing.base_unit,
        "location": s.location, "qty": s.qty, "value": round(float(s.qty * ing.last_unit_cost)),
        "waste_type": s.waste_type, "type_label": label, "type_group": group, "reason": s.reason,
        "status": s.status, "created_by": names.get(s.created_by), "approved_by": names.get(s.approved_by),
        "approved_at": s.approved_at, "order_item_id": s.order_item_id, "shift_id": s.shift_id,
    }
