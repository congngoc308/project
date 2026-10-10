"""Phiếu điều tra: gợi ý nguyên nhân kèm dữ liệu kiểm chứng, kết luận và tất toán (mục 5.9).

Tất toán là phân loại lại, tồn không đổi: mỗi phần phân bổ ghi một giao dịch đảo phần
"chênh lệch chờ giải trình" (+q) và một giao dịch theo đúng nguyên nhân (−q). Riêng "báo hết
nhầm" chỉ có giao dịch đảo, vì hàng tìm thấy quay lại tồn.
"""

from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import clock, domain as d, events
from app.errors import Conflict, Forbidden, Invalid
from app.models import (
    CountLine,
    CountSession,
    Handover,
    HandoverLine,
    Ingredient,
    Investigation,
    Order,
    OrderItem,
    Receipt,
    ReceiptLine,
    RecipeLine,
    RecipeVersion,
    Shift,
    StockTxn,
    User,
    WasteSlip,
)
from app.services import alerts, ledger
from app.services.common import assign_code, audit, dec, get_setting, money, q3
from app.services.format import fmt_money, fmt_num, fmt_qty


def open_for_line(db: Session, line: CountLine, session: CountSession, ing: Ingredient) -> Investigation:
    now = clock.now()
    inv = Investigation(
        count_line_id=line.id,
        ingredient_id=ing.id,
        location=line.location,
        shift_id=line.shift_id,
        responsible_user_id=line.responsible_user_id,
        variance_qty=line.variance_qty,
        variance_value=line.variance_value,
        settled_qty=Decimal(0),
        opened_at=now,
        due_at=now + timedelta(hours=int(get_setting(db, "investigation_due_hours"))),
        allocations=[],
    )
    assign_code(db, inv, "DT")
    inv.suggestions = suggest(db, inv, line, session, ing)
    audit(db, None, "investigation.open", "investigation", inv.id, after={"code": inv.code, "variance": line.variance_qty})
    return inv


def _level(score: int) -> str:
    return "cao" if score >= 50 else "trung bình" if score >= 25 else "thấp"


def suggest(db: Session, inv: Investigation, line: CountLine, session: CountSession, ing: Ingredient) -> list[dict]:
    """Liệt kê các nhóm nguyên nhân có khả năng, kèm dữ liệu kiểm chứng, sắp theo mức khả nghi."""
    u = ing.base_unit
    start = line.period_start or (line.cutoff_at - timedelta(days=1))
    end = line.cutoff_at
    shift = db.get(Shift, line.shift_id) if line.shift_id else None
    variance = line.variance_qty
    theo = line.theoretical_qty or Decimal(0)
    out: list[dict] = []

    def add(cause: str, score: int, evidence: list[str], support: str = "auto") -> None:
        out.append(
            {"cause": cause, "label": d.CAUSES[cause], "score": score, "level": _level(score),
             "evidence": evidence, "support": support}
        )

    # Báo hết nhầm: bắt buộc kiểm kê xác nhận trước khi kết luận.
    if session.kind == d.COUNT_QUICK_OUT:
        # Đã nấu ít hơn lượng sổ còn mà vẫn báo hết → khả năng cao là báo nhầm (hàng vẫn còn).
        add("bao_het_nham", 80 if theo < (line.book_qty or 0) else 60, [
            f"Bếp báo hết lúc {clock.local(end):%H:%M %d/%m} khi tồn sổ tại Bếp còn {fmt_qty(line.book_qty, u)}.",
            "Cần kiểm kê đột xuất tại Bếp để xác nhận trước khi kết luận phiếu.",
        ], "required")

    # Nhập sai
    score, ev = 10, []
    recent = db.execute(
        select(ReceiptLine, Receipt)
        .join(Receipt, Receipt.id == ReceiptLine.receipt_id)
        .where(ReceiptLine.ingredient_id == ing.id, Receipt.received_at.is_not(None),
               Receipt.received_at > start - timedelta(days=1), Receipt.received_at <= end)
        .order_by(Receipt.received_at.desc())
        .limit(3)
    ).all()
    for rl, r in recent:
        ev.append(
            f"Phiếu {r.code} ({r.supplier}): đặt {fmt_num(rl.ordered_qty)} {rl.unit}, nhận {fmt_num(rl.received_qty)} {rl.unit}"
            f" = {fmt_qty(rl.received_qty_base or 0, u)}; đơn giá {fmt_money(rl.unit_price)}/{rl.unit}"
            + ("; có ảnh hóa đơn" if r.invoice_image else "; không có ảnh hóa đơn")
        )
        if r.anomalies:
            score += 40
            ev.append(f"Phiếu {r.code} từng bị đánh dấu bất thường: {', '.join(r.anomalies)}")
        elif rl.received_qty != rl.ordered_qty:
            score += 15
    mism = db.execute(
        select(HandoverLine, Handover)
        .join(Handover, Handover.id == HandoverLine.handover_id)
        .where(HandoverLine.ingredient_id == ing.id, HandoverLine.last_mismatch_qty.is_not(None),
               Handover.issued_at > start - timedelta(hours=12), Handover.issued_at <= end)
    ).all()
    # Lệch cân chỉ là bằng chứng mạnh khi phiếu phải hủy để cân xuất lại (kho thật sự thiếu);
    # nếu cân lại khớp rồi ký trên cùng phiếu thì chỉ là lần cân nhầm.
    strong_mism = False
    for hl, h in mism:
        if h.status == "cancelled":
            strong_mism = True
            score += 40
            ev.append(
                f"Lúc bàn giao {h.code}, bếp trưởng cân lại chỉ được {fmt_qty(hl.last_mismatch_qty, u)} "
                f"so với {fmt_qty(hl.issued_qty, u)} thủ kho cân xuất, phiếu phải hủy → dấu hiệu thiếu từ khâu nhập."
            )
        else:
            ev.append(
                f"Lúc bàn giao {h.code}, bếp trưởng từng cân {fmt_qty(hl.last_mismatch_qty, u)}, "
                f"sau đó cân lại khớp {fmt_qty(hl.issued_qty, u)} rồi mới ký."
            )
    if line.location == d.BEP and shift:
        signed = _signed_qty(db, shift.id, ing.id)
        if signed and not strong_mism:
            ev.append(f"Bếp đã cân lại và ký nhận đủ {fmt_qty(signed, u)} khi nhận bàn giao → khó là lỗi nhập.")
            score = min(score, 10)
    if not recent and not mism:
        ev.append("Không có phiếu nhập nào của nguyên liệu này trong kỳ.")
    add("nhap_sai", score, ev)

    # Thất thoát trong ca bếp
    if line.location == d.BEP and shift:
        signers = _signers(db, shift.id)
        signed = _signed_qty(db, shift.id, ing.id)
        hist = db.execute(
            select(func.count(), func.coalesce(func.sum(CountLine.variance_value), 0))
            .where(CountLine.responsible_user_id == shift.head_chef_id, CountLine.variance_qty > 0,
                   CountLine.location == d.BEP, CountLine.id != line.id,
                   CountLine.cutoff_at > end - timedelta(days=30))
        ).one() if shift.head_chef_id else (0, 0)
        score = 50 + (20 if hist[0] >= 2 else 0)
        add("that_thoat_ca", score, [
            f"{shift.name} {shift.business_date:%d/%m}: bàn giao {fmt_qty(signed, u)}, "
            f"cân trả/đếm được {fmt_qty(line.counted_qty, u)}, lý thuyết {fmt_qty(theo, u)}.",
            f"Người ký nhận: {', '.join(signers) or 'chưa có'}.",
            f"30 ngày qua bếp trưởng này có {hist[0]} lần thiếu khác tại Bếp, tổng {fmt_money(hist[1])}.",
        ])

    # Hao hụt chưa ghi
    slips = db.scalar(select(func.count()).select_from(WasteSlip).where(
        WasteSlip.ingredient_id == ing.id, WasteSlip.location == line.location,
        WasteSlip.at > start, WasteSlip.at <= end)) or 0
    prev_slips = db.scalar(select(func.count()).select_from(WasteSlip).where(
        WasteSlip.ingredient_id == ing.id, WasteSlip.location == line.location,
        WasteSlip.at > end - timedelta(days=7), WasteSlip.at <= start)) or 0
    redo = _cancel_remake_count(db, ing.id, start, end)
    score = 20 + (10 if slips < prev_slips / 7 else 0) - (15 if theo and abs(variance) > theo else 0)
    add("hao_hut_chua_ghi", max(score, 5), [
        f"{slips} phiếu hao hụt, {redo} lần hủy sau chế biến / làm lại trong kỳ.",
        f"7 ngày trước đó: {prev_slips} phiếu hao hụt (trung bình {prev_slips / 7:.1f}/ngày).",
        f"Chênh lệch {fmt_qty(variance, u)} so với lý thuyết {fmt_qty(theo, u)}.",
    ])

    # Định lượng tay (quá tay): xu hướng cùng chiều
    last = db.scalars(
        select(CountLine).where(CountLine.ingredient_id == ing.id, CountLine.location == line.location,
                                CountLine.variance_qty.is_not(None), CountLine.id != line.id)
        .order_by(CountLine.cutoff_at.desc()).limit(5)
    ).all()
    same = [x for x in last if (x.variance_qty > 0) == (variance > 0) and x.variance_qty != 0]
    names = _names(db, [x.responsible_user_id for x in last])
    add("qua_tay", 45 if len(same) >= 3 else 25 if len(same) >= 2 else 10, [
        "5 kỳ gần nhất: " + ("; ".join(
            f"{clock.local(x.cutoff_at):%d/%m %H:%M} {fmt_qty(x.variance_qty, u)}"
            + (f" ({names.get(x.responsible_user_id)})" if x.responsible_user_id else "")
            for x in last) or "chưa có dữ liệu"),
        f"{len(same)}/{len(last)} kỳ lệch cùng chiều.",
    ])

    # Công thức / quy đổi sai
    versions = db.execute(
        select(RecipeVersion).join(RecipeLine, RecipeLine.recipe_version_id == RecipeVersion.id)
        .where(RecipeLine.ingredient_id == ing.id).order_by(RecipeVersion.effective_from.desc()).limit(3)
    ).scalars().all()
    recent_change = [v for v in versions if v.effective_from > end - timedelta(days=7)]
    add("cong_thuc_sai", 40 if recent_change else 10, [
        f"Công thức dùng {ing.name} sửa gần nhất: "
        + ("; ".join(f"v{v.version_no} hiệu lực {clock.local(v.effective_from):%d/%m %H:%M} ({v.reason or 'không ghi lý do'})"
                     for v in versions) or "chưa có"),
        f"Đơn vị cơ sở: {ing.base_unit}; đơn vị mua: {ing.purchase_unit}.",
    ])

    # Kiểm kê trước đó sai
    prev = last[0] if last else None
    if prev:
        prev_sess = db.get(CountSession, prev.session_id)
        counter = _names(db, [prev_sess.counted_by]).get(prev_sess.counted_by, "?")
        opposite = prev.variance_qty * variance < 0 and abs(prev.variance_qty) >= abs(variance) / 2
        add("kiem_ke_sai", 45 if opposite else 10, [
            f"Lần đếm trước ({d.COUNT_KINDS.get(prev_sess.kind)} {prev_sess.code}, "
            f"{clock.local(prev.cutoff_at):%d/%m %H:%M}) do {counter} đếm, lệch {fmt_qty(prev.variance_qty, u)}.",
            "Lệch ngược chiều với kỳ này → có thể lần đếm trước sai." if opposite else "Không có dấu hiệu đếm sai rõ rệt.",
        ])

    # Món làm không qua hệ thống (thủ công)
    if shift:
        sold, revenue = _shift_sales(db, shift.id)
        add("ngoai_he_thong", 15, [
            f"Trong ca có {sold} món đã chế biến trên hệ thống, doanh thu theo đơn {fmt_money(revenue)}.",
            "Không đo trực tiếp được: đối chiếu với tiền thu thực tế trong ca và hỏi lại bếp.",
        ], "manual")

    out.sort(key=lambda s: -s["score"])
    return out


def _signed_qty(db: Session, shift_id: int, ingredient_id: int) -> Decimal:
    return dec(db.scalar(
        select(func.coalesce(func.sum(HandoverLine.issued_qty), 0))
        .join(Handover, Handover.id == HandoverLine.handover_id)
        .where(Handover.shift_id == shift_id, Handover.status == "signed", HandoverLine.ingredient_id == ingredient_id)
    ))


def _signers(db: Session, shift_id: int) -> list[str]:
    ids = db.scalars(select(Handover.received_by).where(Handover.shift_id == shift_id, Handover.status == "signed")).all()
    names = _names(db, ids)
    return sorted({names[i] for i in ids if i in names})


def _names(db: Session, ids) -> dict[int, str]:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    return {u.id: u.full_name for u in db.scalars(select(User).where(User.id.in_(ids)))}


def _cancel_remake_count(db: Session, ingredient_id: int, start, end) -> int:
    return db.scalar(
        select(func.count(func.distinct(StockTxn.source_id))).where(
            StockTxn.ingredient_id == ingredient_id, StockTxn.txn_type == d.TXN_CONSUMPTION_REVERSAL,
            StockTxn.occurred_at > start, StockTxn.occurred_at <= end)
    ) or 0


def _shift_sales(db: Session, shift_id: int) -> tuple[int, Decimal]:
    from app.models import MenuItem

    rows = db.execute(
        select(func.coalesce(func.sum(OrderItem.qty), 0), func.coalesce(func.sum(OrderItem.qty * MenuItem.price), 0))
        .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
        .where(OrderItem.shift_id == shift_id, OrderItem.status.in_([d.ITEM_COOKING, d.ITEM_DONE]))
    ).one()
    return int(rows[0]), dec(rows[1])


def involved_users(db: Session, inv: Investigation) -> set[int]:
    """Những người không được tự kết luận phiếu: người ký nhận ca liên quan và người đếm."""
    ids: set[int] = set()
    if inv.shift_id:
        shift = db.get(Shift, inv.shift_id)
        if shift and shift.head_chef_id:
            ids.add(shift.head_chef_id)
        ids.update(
            x for x in db.scalars(select(Handover.received_by).where(Handover.shift_id == inv.shift_id)) if x
        )
    line = db.get(CountLine, inv.count_line_id)
    sess = db.get(CountSession, line.session_id)
    if sess.counted_by:
        ids.add(sess.counted_by)
    return ids


def _ensure_can_act(db: Session, inv: Investigation, actor: User) -> None:
    if not actor.has(d.MANAGER):
        raise Forbidden("Chỉ quản lý được kết luận phiếu điều tra")
    if actor.id in involved_users(db, inv):
        raise Forbidden("Người đã ký nhận hoặc đếm trong ca liên quan không được tự kết luận phiếu này")
    if inv.status != "open":
        raise Conflict("Phiếu điều tra đã được kết luận")


def _pending_txn(db: Session, inv: Investigation) -> StockTxn:
    line = db.get(CountLine, inv.count_line_id)
    return db.get(StockTxn, line.txn_id)


def verify_false_out(db: Session, inv: Investigation, actor: User, found_qty, note: str = "") -> Investigation:
    """Kiểm kê xác nhận cho phiếu mở từ báo hết: phần hàng tìm thấy được đảo khỏi chênh lệch."""
    _ensure_can_act(db, inv, actor)
    line = db.get(CountLine, inv.count_line_id)
    sess = db.get(CountSession, line.session_id)
    if sess.kind != d.COUNT_QUICK_OUT:
        raise Invalid("Chỉ phiếu mở từ báo hết nguyên liệu mới cần kiểm kê xác nhận")
    if any(a["cause"] == "bao_het_nham" for a in inv.allocations):
        raise Conflict("Phiếu này đã được kiểm kê xác nhận")
    found = q3(dec(found_qty))
    remaining = inv.variance_qty - inv.settled_qty
    if found < 0 or found > remaining:
        raise Invalid(f"Lượng tìm thấy phải từ 0 đến {fmt_num(remaining)}")
    ing = db.get(Ingredient, inv.ingredient_id)
    if found > 0:
        ledger.post(
            db, txn_type=d.TXN_PENDING_SETTLE, ingredient=ing, location=inv.location, qty=found,
            actor_id=actor.id, shift_id=inv.shift_id, source=("investigation", inv.id),
            ref_txn_id=line.txn_id, cause="bao_het_nham", approved_by=actor.id,
            note="Kiểm kê xác nhận: hàng vẫn còn",
        )
    inv.allocations = [*inv.allocations, {
        "cause": "bao_het_nham", "qty": float(found), "value": float(money(found * line.unit_cost)),
        "by": actor.id, "at": clock.now().isoformat(), "note": note,
    }]
    inv.settled_qty = q3(inv.settled_qty + found)
    audit(db, actor.id, "investigation.verify", "investigation", inv.id, after={"found": found, "note": note})
    if inv.settled_qty == inv.variance_qty:
        _close(db, inv, actor, note or "Hàng vẫn còn đủ, báo hết nhầm")
    return inv


def conclude(db: Session, inv: Investigation, actor: User, allocations: list[dict], note: str) -> Investigation:
    """Quản lý chọn nguyên nhân (có thể chia nhiều phần) và duyệt; hệ thống chỉ gợi ý."""
    _ensure_can_act(db, inv, actor)
    if not note.strip():
        raise Invalid("Phải ghi chú căn cứ kết luận")
    line = db.get(CountLine, inv.count_line_id)
    sess = db.get(CountSession, line.session_id)
    if sess.kind == d.COUNT_QUICK_OUT and not any(a["cause"] == "bao_het_nham" for a in inv.allocations):
        raise Conflict("Phiếu mở từ báo hết: phải kiểm kê xác nhận tại Bếp trước khi kết luận")
    remaining = q3(inv.variance_qty - inv.settled_qty)
    if not allocations:
        raise Invalid("Chưa chọn nguyên nhân")
    total = q3(sum((dec(a["qty"]) for a in allocations), Decimal(0)))
    if total != remaining:
        raise Invalid(f"Tổng các phần phân bổ ({fmt_num(total)}) phải bằng phần chưa tất toán ({fmt_num(remaining)})")
    ing = db.get(Ingredient, inv.ingredient_id)
    pending = _pending_txn(db, inv)
    new_allocs = list(inv.allocations)
    for a in allocations:
        cause = a["cause"]
        qty = q3(dec(a["qty"]))
        if cause not in d.CAUSES or cause == "bao_het_nham":
            raise Invalid(f"Nguyên nhân '{cause}' không hợp lệ")
        if qty == 0 or (qty > 0) != (remaining > 0):
            raise Invalid("Mỗi phần phân bổ phải khác 0 và cùng chiều với chênh lệch")
        ref_id, responsible, extra = pending.id, inv.responsible_user_id, {}
        if cause == "nhap_sai":
            rl = db.get(ReceiptLine, int(a.get("receipt_line_id") or 0))
            if rl is None or rl.ingredient_id != ing.id or rl.txn_id is None:
                raise Invalid("Kết luận 'nhập sai' phải chọn dòng phiếu nhập gốc của nguyên liệu này")
            ref_id = rl.txn_id
            responsible = db.get(Receipt, rl.receipt_id).received_by
            extra = {"receipt_line_id": rl.id}
        ledger.post(
            db, txn_type=d.TXN_PENDING_SETTLE, ingredient=ing, location=inv.location, qty=qty,
            actor_id=actor.id, shift_id=inv.shift_id, source=("investigation", inv.id), ref_txn_id=pending.id,
            cause=cause, approved_by=actor.id, unit_cost=pending.unit_cost,
        )
        ledger.post(
            db, txn_type=d.CAUSE_TXN[cause], ingredient=ing, location=inv.location, qty=-qty,
            actor_id=actor.id, shift_id=inv.shift_id, source=("investigation", inv.id), ref_txn_id=ref_id,
            waste_type=cause if d.CAUSE_TXN[cause] == d.TXN_WASTE else None,
            late=d.CAUSE_TXN[cause] == d.TXN_WASTE, cause=cause, responsible_user_id=responsible,
            approved_by=actor.id, unit_cost=pending.unit_cost, note=a.get("note") or note,
        )
        new_allocs.append({
            "cause": cause, "qty": float(qty), "value": float(money(qty * pending.unit_cost)),
            "by": actor.id, "at": clock.now().isoformat(), "note": a.get("note") or "", **extra,
        })
    inv.allocations = new_allocs
    inv.settled_qty = q3(inv.settled_qty + total)
    _close(db, inv, actor, note)
    return inv


def _close(db: Session, inv: Investigation, actor: User, note: str) -> None:
    inv.status = "concluded"
    inv.conclusion_note = note
    inv.concluded_by = actor.id
    inv.concluded_at = clock.now()
    alerts.resolve_by_key(db, f"overdue:{inv.id}", actor.id)
    for a in db.scalars(select(alerts.Alert).where(alerts.Alert.ref_type == "investigation", alerts.Alert.ref_id == inv.id,
                                                    alerts.Alert.status == "open")):
        a.status = "resolved"
        a.resolved_at = clock.now()
        a.resolved_by = actor.id
    audit(db, actor.id, "investigation.conclude", "investigation", inv.id,
          after={"allocations": inv.allocations, "note": note})
    events.emit(db, events.MANAGER, "investigation", {"id": inv.id, "status": inv.status})


def investigation_dict(db: Session, inv: Investigation, detail: bool = False) -> dict:
    ing = db.get(Ingredient, inv.ingredient_id)
    shift = db.get(Shift, inv.shift_id) if inv.shift_id else None
    names = _names(db, [inv.responsible_user_id, inv.concluded_by])
    now = clock.now()
    out = {
        "id": inv.id,
        "code": inv.code,
        "ingredient": {"id": ing.id, "name": ing.name, "unit": ing.base_unit, "group": ing.control_group},
        "location": inv.location,
        "shift": {"id": shift.id, "name": shift.name, "business_date": shift.business_date} if shift else None,
        "responsible": names.get(inv.responsible_user_id),
        "variance_qty": inv.variance_qty,
        "variance_value": inv.variance_value,
        "settled_qty": inv.settled_qty,
        "opened_at": inv.opened_at,
        "due_at": inv.due_at,
        "status": inv.status,
        "overdue": inv.status == "open" and inv.due_at < now,
        "due_soon": inv.status == "open" and now <= inv.due_at < now + timedelta(hours=12),
        "concluded_at": inv.concluded_at,
        "concluded_by": names.get(inv.concluded_by),
        "conclusion_note": inv.conclusion_note,
        "allocations": inv.allocations,
    }
    if detail:
        line = db.get(CountLine, inv.count_line_id)
        sess = db.get(CountSession, line.session_id)
        out["count"] = {
            "session_id": sess.id, "code": sess.code, "kind": sess.kind, "cutoff_at": line.cutoff_at,
            "period_start": line.period_start, "book_qty": line.book_qty, "counted_qty": line.counted_qty,
            "theoretical_qty": line.theoretical_qty, "recorded_waste_qty": line.recorded_waste_qty,
            "variance_pct": line.variance_pct, "unit_cost": line.unit_cost,
            "counted_by": _names(db, [sess.counted_by]).get(sess.counted_by),
        }
        out["suggestions"] = inv.suggestions
        out["needs_verification"] = sess.kind == d.COUNT_QUICK_OUT and not any(
            a["cause"] == "bao_het_nham" for a in inv.allocations)
        out["involved_user_ids"] = sorted(involved_users(db, inv))
        out["receipt_lines"] = [
            {"id": rl.id, "receipt_code": r.code, "supplier": r.supplier, "received_at": r.received_at,
             "received_qty": rl.received_qty, "unit": rl.unit, "received_qty_base": rl.received_qty_base}
            for rl, r in db.execute(
                select(ReceiptLine, Receipt).join(Receipt, Receipt.id == ReceiptLine.receipt_id)
                .where(ReceiptLine.ingredient_id == ing.id, ReceiptLine.txn_id.is_not(None))
                .order_by(Receipt.received_at.desc()).limit(10)
            ).all()
        ]
    return out


def list_open_for_dashboard(db: Session) -> dict:
    now = clock.now()
    rows = db.scalars(select(Investigation).where(Investigation.status == "open")).all()
    return {
        "open": len(rows),
        "due_soon": sum(1 for r in rows if now <= r.due_at < now + timedelta(hours=12)),
        "overdue": sum(1 for r in rows if r.due_at < now),
        "open_value": float(sum((abs(r.variance_value) for r in rows), Decimal(0))),
    }
