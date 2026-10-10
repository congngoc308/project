import os
import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.auth.security import current_user, require
from app.config import settings
from app.db import get_db
from app.errors import Forbidden, Invalid, NotFound
from app.models import CountSession, Handover, Ingredient, Receipt, ReceiptLine, Shift, User, WasteSlip
from app.services import catalog, counts, handover, ledger, receiving, shifts, waste
from app.services.common import get_or_404

router = APIRouter(tags=["Kho"])
storekeeper = require(d.STOREKEEPER, d.MANAGER)
manager = require(d.MANAGER)


# ---- Phiếu nhập ----

class ReceiptLineIn(BaseModel):
    ingredient_id: int
    unit: str | None = None
    ordered_qty: Decimal
    unit_price: Decimal = Decimal(0)
    expiry_date: date | None = None


class ReceiptIn(BaseModel):
    supplier: str
    order_date: date | None = None
    lines: list[ReceiptLineIn]
    note: str = ""


@router.get("/receipts")
def list_receipts(status: str | None = None, db: Session = Depends(get_db), _: User = Depends(storekeeper)):
    stmt = select(Receipt).order_by(Receipt.id.desc()).limit(100)
    if status:
        stmt = stmt.where(Receipt.status == status)
    return [receiving.receipt_dict(db, r) for r in db.scalars(stmt)]


@router.post("/receipts")
def create_receipt(body: ReceiptIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    r = receiving.create(db, actor, body.supplier, body.order_date, [ln.model_dump() for ln in body.lines], body.note)
    db.commit()
    return receiving.receipt_dict(db, r)


@router.get("/receipts/{rid}")
def get_receipt(rid: int, db: Session = Depends(get_db), _: User = Depends(storekeeper)):
    return receiving.receipt_dict(db, get_or_404(db, Receipt, rid, "Phiếu nhập"))


class ReceiveLineIn(BaseModel):
    line_id: int
    received_qty: Decimal
    diff_reason: str | None = None
    unit_price: Decimal | None = None
    expiry_date: date | None = None


class ReceiveIn(BaseModel):
    lines: list[ReceiveLineIn]
    invoice_image: str | None = None


@router.post("/receipts/{rid}/receive")
def receive(rid: int, body: ReceiveIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    r = get_or_404(db, Receipt, rid, "Phiếu nhập")
    receiving.receive(db, actor, r, [ln.model_dump() for ln in body.lines], body.invoice_image)
    db.commit()
    return receiving.receipt_dict(db, r)


class NoteIn(BaseModel):
    note: str = ""


@router.post("/receipts/{rid}/approve")
def approve_receipt(rid: int, body: NoteIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    r = receiving.approve(db, actor, get_or_404(db, Receipt, rid, "Phiếu nhập"), body.note)
    db.commit()
    return receiving.receipt_dict(db, r)


@router.post("/receipts/{rid}/cancel")
def cancel_receipt(rid: int, body: NoteIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    r = receiving.cancel(db, actor, get_or_404(db, Receipt, rid, "Phiếu nhập"), body.note)
    db.commit()
    return receiving.receipt_dict(db, r)


class CorrectIn(BaseModel):
    correct_qty: Decimal
    reason: str


@router.post("/receipt-lines/{line_id}/correct")
def correct_line(line_id: int, body: CorrectIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    ln = get_or_404(db, ReceiptLine, line_id, "Dòng phiếu nhập")
    receiving.correct_line(db, actor, ln, body.correct_qty, body.reason)
    db.commit()
    return receiving.receipt_dict(db, db.get(Receipt, ln.receipt_id))


@router.post("/uploads")
async def upload(file: UploadFile = File(...), _: User = Depends(storekeeper)):
    """Ảnh hóa đơn (tùy chọn) lưu vào thư mục local."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".pdf"):
        raise Invalid("Chỉ nhận ảnh JPG/PNG/WEBP hoặc PDF")
    os.makedirs(settings.upload_dir, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise Invalid("Tệp tối đa 8 MB")
    with open(os.path.join(settings.upload_dir, name), "wb") as f:
        f.write(data)
    return {"path": name}


@router.get("/uploads/{name}")
def get_upload(name: str, _: User = Depends(current_user)):
    path = os.path.join(settings.upload_dir, os.path.basename(name))
    if not os.path.exists(path):
        raise NotFound("Không tìm thấy tệp")
    return FileResponse(path)


# ---- Bàn giao ca bếp ----

class HandoverLineIn(BaseModel):
    ingredient_id: int
    qty: Decimal
    unit: str | None = None


class HandoverIn(BaseModel):
    kind: str = "start"
    lines: list[HandoverLineIn]
    note: str = ""


@router.get("/handovers")
def list_handovers(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    # Bếp trưởng thấy phiếu chờ ký nhưng không thấy số thủ kho cân xuất, để tự cân lại độc lập.
    show = user.has(d.STOREKEEPER, d.MANAGER)
    return [handover.handover_dict(db, h, show_issued=show) for h in handover.list_handovers(db, status)]


@router.post("/handovers")
def create_handover(body: HandoverIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    h = handover.create(db, actor, body.kind, [ln.model_dump() for ln in body.lines], body.note)
    db.commit()
    return handover.handover_dict(db, h)


class SignIn(BaseModel):
    signer_id: int
    pin: str
    received: dict[int, Decimal]


@router.post("/handovers/{hid}/sign")
def sign_handover(hid: int, body: SignIn, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if not actor.has(d.STOREKEEPER, d.HEAD_CHEF, d.MANAGER):
        raise Forbidden("Bạn không có quyền ký bàn giao")
    h = get_or_404(db, Handover, hid, "Phiếu bàn giao")
    res = handover.sign(db, actor, h, body.signer_id, body.pin, body.received)
    db.commit()
    if not res["ok"]:
        return JSONResponse(
            jsonable_encoder({"detail": "Số cân hai bên lệch quá dung sai: cân lại trước khi ký", "data": res["mismatches"]}),
            status_code=409,
        )
    return handover.handover_dict(db, h)


@router.post("/handovers/{hid}/cancel")
def cancel_handover(hid: int, body: NoteIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    h = handover.cancel(db, actor, get_or_404(db, Handover, hid, "Phiếu bàn giao"), body.note)
    db.commit()
    return handover.handover_dict(db, h)


# ---- Ca và cân trả cuối ca ----

@router.get("/shifts")
def list_shifts(days: int = 7, db: Session = Depends(get_db), _: User = Depends(current_user)):
    today = clock.business_date(clock.now())
    for i in range(days):
        shifts.ensure_shifts(db, today - timedelta(days=i))
    db.commit()
    rows = db.scalars(select(Shift).where(Shift.business_date > today - timedelta(days=days))
                      .order_by(Shift.planned_start.desc()))
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    return [{**shifts.shift_dict(s), "head_chef": names.get(s.head_chef_id)} for s in rows]


@router.get("/shifts/current")
def current_shift(db: Session = Depends(get_db), _: User = Depends(current_user)):
    s = shifts.open_shift(db) or shifts.shift_at(db, clock.now())
    db.commit()
    return shifts.shift_dict(s)


@router.get("/shifts/{sid}/return-form")
def return_form(sid: int, db: Session = Depends(get_db), _: User = Depends(storekeeper)):
    """Form cân trả mù: chỉ tên nguyên liệu và đơn vị, không có tồn sổ (AC-08)."""
    s = get_or_404(db, Shift, sid, "Ca")
    return {"shift": shifts.shift_dict(s),
            "ingredients": [{"id": i.id, "name": i.name, "unit": i.base_unit} for i in counts.return_ingredients(db, s)]}


class CountsIn(BaseModel):
    counts: dict[int, Decimal]
    note: str = ""


@router.post("/shifts/{sid}/return")
def submit_return(sid: int, body: CountsIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    s = get_or_404(db, Shift, sid, "Ca")
    sess = counts.submit_return(db, actor, s, body.counts, body.note)
    db.commit()
    return {"ok": True, "session_id": sess.id, "code": sess.code}


# ---- Kiểm kê ----

class CountCreateIn(BaseModel):
    kind: str
    location: str
    ingredient_ids: list[int] | None = None
    group: str | None = None
    random_n: int | None = None
    note: str = ""


@router.get("/counts")
def list_counts(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(storekeeper)):
    return [counts.session_dict(db, s, user) for s in counts.list_sessions(db, status)]


@router.post("/counts")
def create_count(body: CountCreateIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    s = counts.create_session(db, actor, body.kind, body.location, body.ingredient_ids, body.group, body.random_n, body.note)
    db.commit()
    return counts.session_dict(db, s, actor)


@router.get("/counts/{cid}")
def get_count(cid: int, db: Session = Depends(get_db), user: User = Depends(storekeeper)):
    return counts.session_dict(db, get_or_404(db, CountSession, cid, "Phiên kiểm kê"), user)


@router.post("/counts/{cid}/submit")
def submit_count(cid: int, body: CountsIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    s = counts.submit_session(db, actor, get_or_404(db, CountSession, cid, "Phiên kiểm kê"), body.counts)
    db.commit()
    # Người đếm không thấy tồn sổ hay chênh lệch; chỉ quản lý thấy sau khi chốt.
    return counts.session_dict(db, s, actor)


@router.post("/counts/{cid}/review")
def review_count(cid: int, db: Session = Depends(get_db), actor: User = Depends(manager)):
    s = counts.review(db, actor, get_or_404(db, CountSession, cid, "Phiên kiểm kê"))
    db.commit()
    return counts.session_dict(db, s, actor)


@router.post("/counts/{cid}/correction")
def correction(cid: int, body: NoteIn, db: Session = Depends(get_db), actor: User = Depends(storekeeper)):
    s = counts.create_correction(db, actor, get_or_404(db, CountSession, cid, "Phiên kiểm kê"), body.note)
    db.commit()
    return counts.session_dict(db, s, actor)


# ---- Hao hụt ----

class WasteIn(BaseModel):
    ingredient_id: int
    qty: Decimal
    unit: str | None = None
    waste_type: str
    reason: str = ""
    location: str | None = None


@router.get("/waste")
def list_waste(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = select(WasteSlip).order_by(WasteSlip.at.desc()).limit(150)
    if status == "pending":
        stmt = stmt.where(WasteSlip.status.in_(["pending_chef", "pending_manager"]))
    elif status:
        stmt = stmt.where(WasteSlip.status == status)
    if not user.has(d.MANAGER, d.HEAD_CHEF):
        stmt = stmt.where(WasteSlip.created_by == user.id)
    return [waste.slip_dict(db, s) for s in db.scalars(stmt)]


@router.post("/waste")
def create_waste(body: WasteIn, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if not actor.has(d.KITCHEN, d.HEAD_CHEF, d.STOREKEEPER, d.MANAGER):
        raise Forbidden("Bạn không có quyền ghi hao hụt")
    ing = get_or_404(db, Ingredient, body.ingredient_id, "Nguyên liệu")
    s = waste.create(db, actor, ing, body.qty, body.unit or ing.base_unit, body.waste_type, body.reason, body.location)
    db.commit()
    return waste.slip_dict(db, s)


@router.post("/waste/{wid}/approve")
def approve_waste(wid: int, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    s = waste.approve(db, actor, get_or_404(db, WasteSlip, wid, "Phiếu hao hụt"))
    db.commit()
    return waste.slip_dict(db, s)


@router.post("/waste/{wid}/reject")
def reject_waste(wid: int, body: NoteIn, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    s = waste.reject(db, actor, get_or_404(db, WasteSlip, wid, "Phiếu hao hụt"), body.note)
    db.commit()
    return waste.slip_dict(db, s)


# ---- Tồn sổ (chỉ quản lý) ----

@router.get("/stock")
def stock(db: Session = Depends(get_db), _: User = Depends(manager)):
    """Tồn sổ theo vị trí và số phần còn làm được (tham khảo khi bếp báo hết)."""
    books = ledger.books(db)
    portions: dict[int, list] = {}
    from app.models import MenuItem

    for mi in db.scalars(select(MenuItem).where(MenuItem.status == "selling")):
        v = catalog.effective_version(db, mi.id)
        if not v:
            continue
        for ln in v.lines:
            portions.setdefault(ln.ingredient_id, []).append((mi.name, ln.issue_qty_base))
    out = []
    for i in db.scalars(select(Ingredient).order_by(Ingredient.control_group, Ingredient.name)):
        kho = books.get((i.id, d.KHO), Decimal(0))
        bep = books.get((i.id, d.BEP), Decimal(0))
        out.append({
            "id": i.id, "code": i.code, "name": i.name, "group": i.control_group, "unit": i.base_unit,
            "kho": kho, "bep": bep, "total": kho + bep, "value": (kho + bep) * i.last_unit_cost,
            "min_stock": i.min_stock, "below_min": (kho + bep) < i.min_stock,
            "portions": [{"dish": name, "portions": int((kho + bep) // q) if q > 0 else None}
                         for name, q in portions.get(i.id, [])],
        })
    return {"rows": out, "cache_mismatch": ledger.verify_cache(db)}
