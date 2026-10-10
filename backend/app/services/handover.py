"""Bàn giao nhóm A từ Kho sang Bếp, có cân lại và ký nhận bằng PIN (5.5, BR-08)."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import clock, domain as d, events
from app.auth.security import verify_pin
from app.errors import Conflict, Forbidden, Invalid
from app.models import Handover, HandoverLine, Ingredient, Shift, User
from app.services import alerts, ledger, shifts
from app.services.common import assign_code, audit, dec, get_or_404, get_setting, q3, to_base
from app.services.format import fmt_qty


def create(db: Session, actor: User, kind: str, lines: list[dict], note: str = "") -> Handover:
    if kind not in ("start", "supplement"):
        raise Invalid("Loại bàn giao không hợp lệ")
    now = clock.now()
    current = shifts.open_shift(db)
    if kind == "start":
        if current:
            raise Conflict(f"{current.name} {current.business_date:%d/%m} đang mở. Cân trả ca đó trước, "
                           "hoặc dùng bàn giao bổ sung.")
        shift = shifts.shift_for_handover(db, now)
        if shift is None:
            raise Conflict("Không có ca nào đang chờ nhận bàn giao (ca hiện tại đã cân trả, "
                           "ca kế tiếp chưa tới giờ nhận trong vòng 60 phút)")
    else:
        if current is None:
            raise Conflict("Chưa có ca nào đang mở; hãy bàn giao đầu ca trước")
        shift = current
    if not lines:
        raise Invalid("Phiếu bàn giao chưa có nguyên liệu")
    h = Handover(shift_id=shift.id, kind=kind, status="pending", issued_by=actor.id, issued_at=now, note=note)
    assign_code(db, h, "BG")
    seen = set()
    for ln in lines:
        ing = get_or_404(db, Ingredient, int(ln["ingredient_id"]), "Nguyên liệu")
        if ing.control_group != d.GROUP_A:
            raise Invalid(f"{ing.name} thuộc nhóm C, không đi qua bàn giao (chỉ nằm ở Kho)")
        if ing.id in seen:
            raise Invalid(f"{ing.name} bị lặp")
        seen.add(ing.id)
        qty = to_base(db, ing, ln["qty"], ln.get("unit") or ing.base_unit)
        if qty <= 0:
            raise Invalid("Lượng cân xuất phải lớn hơn 0")
        db.add(HandoverLine(handover_id=h.id, ingredient_id=ing.id, issued_qty=qty))
    db.flush()
    audit(db, actor.id, "handover.create", "handover", h.id, after={"kind": kind, "shift": shift.id, "lines": lines})
    events.emit(db, events.KITCHEN, "handover", {"id": h.id, "status": h.status})
    events.emit(db, events.STORE, "handover", {"id": h.id, "status": h.status})
    return h


def sign(db: Session, actor: User, h: Handover, signer_id: int, pin: str, received: dict[int, Decimal]) -> dict:
    """Bếp trưởng cân lại và ký nhận. Hai số lệch quá dung sai thì phải cân lại, chưa chuyển tồn.

    Trả về {"ok": False, "mismatches": [...]} khi lệch: lần ký bị từ chối vẫn được lưu làm bằng
    chứng (bếp báo thiếu khi nhận bàn giao), nên router commit trước khi báo lỗi.
    """
    if h.status != "pending":
        raise Conflict("Phiếu bàn giao không còn chờ ký")
    signer = get_or_404(db, User, signer_id, "Người dùng")
    if not signer.has(d.HEAD_CHEF):
        raise Forbidden(f"{signer.full_name} không phải bếp trưởng ca")
    verify_pin(db, signer, pin)
    tol = dec(get_setting(db, "handover_tolerance"))
    lines = db.scalars(select(HandoverLine).where(HandoverLine.handover_id == h.id)).all()
    mismatches = []
    for ln in lines:
        if ln.id not in received and str(ln.id) not in received:
            raise Invalid("Bếp trưởng phải cân lại tất cả nguyên liệu trước khi ký")
        got = q3(dec(received.get(ln.id, received.get(str(ln.id)))))
        ln.received_qty = got
        if abs(got - ln.issued_qty) > tol:
            ing = db.get(Ingredient, ln.ingredient_id)
            ln.last_mismatch_qty = got
            mismatches.append({
                "line_id": ln.id, "ingredient": ing.name, "issued_qty": ln.issued_qty, "received_qty": got,
                "unit": ing.base_unit,
            })
    if mismatches:
        h.mismatch_attempts += 1
        audit(db, signer.id, "handover.mismatch", "handover", h.id, after={"mismatches": mismatches})
        detail = "; ".join(
            f"{m['ingredient']}: xuất {fmt_qty(m['issued_qty'], m['unit'])}, bếp cân {fmt_qty(m['received_qty'], m['unit'])}"
            for m in mismatches
        )
        alerts.raise_alert(
            db, "handover_mismatch", "warn", f"Bàn giao {h.code}: số cân hai bên lệch quá dung sai",
            detail + ". Phải cân lại trước khi ký; nếu kho thật sự thiếu thì kiểm tra khâu nhập.",
            shift_id=h.shift_id, ref=("handover", h.id), dedupe=f"handover_mismatch:{h.id}",
        )
        return {"ok": False, "mismatches": mismatches}

    shift = db.get(Shift, h.shift_id)
    now = clock.now()
    ings = {ln.ingredient_id: db.get(Ingredient, ln.ingredient_id) for ln in lines}
    ledger.lock(db, [(i, loc) for i in ings for loc in (d.KHO, d.BEP)])
    for ln in lines:
        ing = ings[ln.ingredient_id]
        # Người tạo = thủ kho cân xuất, người duyệt = bếp trưởng ký nhận, dù ký trên máy của ai.
        common = dict(ingredient=ing, actor_id=h.issued_by, shift_id=shift.id, source=("handover", h.id),
                      approved_by=signer.id, responsible_user_id=signer.id, occurred_at=now)
        ledger.post(db, txn_type=d.TXN_HANDOVER_OUT, location=d.KHO, qty=-ln.issued_qty, **common)
        ledger.post(db, txn_type=d.TXN_HANDOVER_IN, location=d.BEP, qty=ln.issued_qty, **common)
    h.status = "signed"
    h.received_by = signer.id
    h.signed_at = now
    if shift.status == "planned":
        shift.status = "open"
        shift.opened_at = now
        shift.head_chef_id = signer.id
    if signer.id == h.issued_by:
        shifts.mark_sod(shift, f"{signer.full_name} vừa cân xuất vừa ký nhận bàn giao {h.code}")
    alerts.resolve_by_key(db, f"handover_unsigned:{h.id}")
    alerts.resolve_by_key(db, f"handover_mismatch:{h.id}")
    audit(db, signer.id, "handover.sign", "handover", h.id,
          after={"received": {ln.id: ln.received_qty for ln in lines}})
    events.emit(db, events.KITCHEN, "handover", {"id": h.id, "status": h.status})
    events.emit(db, events.STORE, "handover", {"id": h.id, "status": h.status})
    return {"ok": True}


def cancel(db: Session, actor: User, h: Handover, reason: str) -> Handover:
    if h.status != "pending":
        raise Conflict("Chỉ hủy được phiếu chưa ký")
    h.status = "cancelled"
    h.note = (h.note + f"\nHủy: {reason}").strip()
    alerts.resolve_by_key(db, f"handover_unsigned:{h.id}")
    audit(db, actor.id, "handover.cancel", "handover", h.id, note=reason)
    return h


def handover_dict(db: Session, h: Handover, show_issued: bool = True) -> dict:
    shift = db.get(Shift, h.shift_id)
    users = {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_([h.issued_by, h.received_by or 0])))}
    lines = []
    for ln in db.scalars(select(HandoverLine).where(HandoverLine.handover_id == h.id).order_by(HandoverLine.id)):
        ing = db.get(Ingredient, ln.ingredient_id)
        lines.append({
            "id": ln.id, "ingredient_id": ing.id, "ingredient": ing.name, "unit": ing.base_unit,
            "issued_qty": ln.issued_qty if show_issued else None, "received_qty": ln.received_qty,
            "last_mismatch_qty": ln.last_mismatch_qty,
        })
    return {
        "id": h.id, "code": h.code, "kind": h.kind, "status": h.status,
        "shift": shifts.shift_dict(shift), "issued_by": users.get(h.issued_by), "issued_at": h.issued_at,
        "received_by": users.get(h.received_by), "signed_at": h.signed_at, "mismatch_attempts": h.mismatch_attempts,
        "note": h.note, "lines": lines,
    }


def list_handovers(db: Session, status: str | None = None, limit: int = 50) -> list[Handover]:
    stmt = select(Handover).options(selectinload(Handover.lines)).order_by(Handover.issued_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Handover.status == status)
    return list(db.scalars(stmt))
