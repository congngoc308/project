"""AC-06 → AC-11: số thực tế độc lập (nhập hàng, bàn giao, cân trả mù, kiểm kê, ngưỡng hai tầng)."""

from sqlalchemy import select

from app.models import Alert, Investigation, StockTxn
from app.services import monitor
from tests.helpers import advance, current_shift, handover, receive, return_shift, sell


def _book(mgr, ing_id):
    row = next(r for r in mgr.get("/stock")["rows"] if r["id"] == ing_id)
    return float(row["kho"]), float(row["bep"])


def test_ac06_receipt_received_increases_kho_and_updates_cost(as_user, ref, db):
    sk, mgr = as_user("thukho1"), as_user("quanly")
    r = receive(sk, ref["BO"], 2, price=260000)
    assert r["status"] == "received"
    assert _book(mgr, ref["BO"]) == (2000.0, 0.0)
    ing = next(i for i in mgr.get("/ingredients") if i["id"] == ref["BO"])
    assert float(ing["last_unit_cost"]) == 260.0

    # Số nhận khác số đặt: bắt buộc lý do, phiếu chuyển Chờ duyệt nhưng tồn vẫn tăng ngay.
    created = sk.post("/receipts", {"supplier": "Chợ", "lines": [
        {"ingredient_id": ref["BO"], "unit": "kg", "ordered_qty": 2, "unit_price": 260000}]})
    sk.post(f"/receipts/{created['id']}/receive", {"lines": [
        {"line_id": created["lines"][0]["id"], "received_qty": 1.5}]}, expect=400)
    r2 = sk.post(f"/receipts/{created['id']}/receive", {"lines": [
        {"line_id": created["lines"][0]["id"], "received_qty": 1.5, "diff_reason": "NCC giao thiếu"}]})
    assert r2["status"] == "pending_approval"
    assert _book(mgr, ref["BO"]) == (3500.0, 0.0)
    sk.post(f"/receipts/{created['id']}/approve", {"note": ""}, expect=403)
    assert mgr.post(f"/receipts/{created['id']}/approve", {"note": "Đã gọi NCC"})["status"] == "approved"

    # Nhập nhầm đơn vị (1.000 thay vì 1) bị đánh dấu bất thường.
    r3 = receive(sk, ref["BO"], 2000, price=260)
    assert r3["status"] == "pending_approval"
    assert any("nhầm đơn vị" in a for a in r3["anomalies"])


def test_ac07_unsigned_handover_does_not_move_stock_and_late_return_alerts(as_user, ref, db):
    sk, chef, mgr = as_user("thukho1"), as_user("beptruong1"), as_user("quanly")
    receive(sk, ref["BO"], 1)
    h = sk.post("/handovers", {"kind": "start", "lines": [{"ingredient_id": ref["BO"], "qty": 1000}]})
    assert _book(mgr, ref["BO"]) == (1000.0, 0.0)
    advance(20)
    monitor.scan(db)
    db.commit()
    assert db.scalar(select(Alert).where(Alert.kind == "handover_unsigned"))

    chef._call("POST", f"/handovers/{h['id']}/sign", 200, json={
        "signer_id": ref["beptruong1"], "pin": "00000", "received": {h["lines"][0]["id"]: 998}})
    assert _book(mgr, ref["BO"]) == (0.0, 1000.0)  # trong dung sai 5 g: chuyển đúng số thủ kho cân xuất

    advance(60 * 8)  # quá 14:00 + 30 phút
    monitor.scan(db)
    db.commit()
    alert = db.scalar(select(Alert).where(Alert.kind == "shift_not_returned"))
    assert alert and alert.severity == "critical"
    dash = mgr.get("/dashboard")
    assert any(s["late_return"] for s in dash["shifts"])


def test_ac08_blind_return_and_count_screens(as_user, ref):
    sk, chef, k, mgr = as_user("thukho1"), as_user("beptruong1"), as_user("bep1"), as_user("quanly")
    receive(sk, ref["BO"], 1)
    h = sk.post("/handovers", {"kind": "start", "lines": [{"ingredient_id": ref["BO"], "qty": 1000}]})
    # Bếp trưởng không thấy số thủ kho cân xuất khi cân lại.
    pending = chef.get("/handovers?status=pending")[0]
    assert pending["lines"][0]["issued_qty"] is None
    chef._call("POST", f"/handovers/{h['id']}/sign", 200, json={
        "signer_id": ref["beptruong1"], "pin": "00000", "received": {h["lines"][0]["id"]: 1000}})
    shift = current_shift(sk)

    form = sk.get(f"/shifts/{shift['id']}/return-form")
    assert form["ingredients"] == [{"id": ref["BO"], "name": "Thịt bò", "unit": "g"}]
    k.get(f"/shifts/{shift['id']}/return-form", expect=403)
    k._call("POST", f"/shifts/{shift['id']}/return", 403, json={"counts": {str(ref["BO"]): 1000}})
    chef._call("POST", f"/shifts/{shift['id']}/return", 403, json={"counts": {str(ref["BO"]): 1000}})
    k.get("/stock", expect=403)
    sk.get("/stock", expect=403)
    assert "book_kho" not in k.get("/ingredients")[0]

    s = sk.post("/counts", {"kind": "periodic", "location": "kho", "group": "A"})
    assert all("book_qty" not in ln for ln in s["lines"])
    done = sk.post(f"/counts/{s['id']}/submit", {"counts": {str(ln["ingredient_id"]): 0 for ln in s["lines"]}})
    assert all("book_qty" not in ln and "variance_qty" not in ln for ln in done["lines"])
    revealed = mgr.get(f"/counts/{s['id']}")
    assert all("book_qty" in ln for ln in revealed["lines"])


def test_ac09_count_adjustment_vs_pending_variance(as_user, ref, db):
    sk = as_user("thukho1")
    receive(sk, ref["BO"], 1)
    advance()
    s = sk.post("/counts", {"kind": "periodic", "location": "kho", "ingredient_ids": [ref["BO"]]})
    sk.post(f"/counts/{s['id']}/submit", {"counts": {str(ref["BO"]): 990}})
    adj = db.scalars(select(StockTxn).where(StockTxn.txn_type == "count_adjustment")).all()
    assert [float(t.qty) for t in adj] == [-10.0]  # = thực đếm − tồn sổ

    advance()
    s2 = sk.post("/counts", {"kind": "periodic", "location": "kho", "ingredient_ids": [ref["BO"]]})
    sk.post(f"/counts/{s2['id']}/submit", {"counts": {str(ref["BO"]): 700}})
    pend = db.scalars(select(StockTxn).where(StockTxn.txn_type == "pending_variance")).all()
    assert [float(t.qty) for t in pend] == [-290.0]
    inv = db.scalar(select(Investigation))
    assert inv and float(inv.variance_qty) == 290.0 and inv.status == "open"


def _shift_with_portions(as_user, ref, portions: int, beef_back: float):
    sk, chef = as_user("thukho1"), as_user("beptruong1")
    receive(sk, ref["BO"], 1)
    receive(sk, ref["RAU"], 3, price=30000)
    advance()
    handover(sk, chef, ref["beptruong1"], "00000", {ref["BO"]: 1000, ref["RAU"]: 3000})
    advance()
    sell(as_user("phucvu1"), as_user("bep1"), ref["BX_dish"], portions)
    advance(60)
    shift = current_shift(sk)
    return_shift(sk, shift["id"], {ref["BO"]: beef_back, ref["RAU"]: 3000 - 30 * portions})
    return shift


def test_ac10_49_or_51_portions_within_threshold(as_user, ref, db):
    _shift_with_portions(as_user, ref, 49, 0)
    line = as_user("quanly").get("/reports/counts")
    beef = [x for x in line if x["ingredient"] == "Thịt bò"]
    assert beef[0]["tier"] == "ok" and float(beef[0]["variance_qty"]) == 20.0
    assert db.scalar(select(Alert).where(Alert.kind.like("variance_%"))) is None


def test_ac10_51_portions_within_threshold(as_user, ref, db):
    _shift_with_portions(as_user, ref, 51, 0)
    beef = [x for x in as_user("quanly").get("/reports/counts") if x["ingredient"] == "Thịt bò"]
    assert beef[0]["tier"] == "ok" and float(beef[0]["variance_qty"]) == -20.0
    assert db.scalar(select(Alert).where(Alert.kind.like("variance_%"))) is None


def test_ac11_one_kg_five_bowls_returned_zero(as_user, ref, db):
    shift = _shift_with_portions(as_user, ref, 5, 0)
    mgr = as_user("quanly")
    invs = mgr.get("/investigations?status=open")
    assert len(invs) == 1
    inv = mgr.get(f"/investigations/{invs[0]['id']}")
    assert float(inv["variance_qty"]) == 900.0
    assert float(inv["variance_value"]) == 225000.0
    assert inv["shift"]["id"] == shift["id"]
    assert inv["responsible"] == "Nguyễn Văn Bình"
    assert float(inv["count"]["theoretical_qty"]) == 100.0
    assert float(inv["count"]["variance_pct"]) == 900.0
    causes = [s["cause"] for s in inv["suggestions"]]
    assert causes[0] == "that_thoat_ca"
    assert {"nhap_sai", "hao_hut_chua_ghi", "qua_tay", "cong_thuc_sai"} <= set(causes)
    nhap_sai = next(s for s in inv["suggestions"] if s["cause"] == "nhap_sai")
    assert nhap_sai["level"] == "thấp"
    pending = db.scalar(select(StockTxn).where(StockTxn.txn_type == "pending_variance"))
    assert float(pending.qty) == -900.0 and pending.location == "bep" and pending.shift_id == shift["id"]
    assert db.scalar(select(Alert).where(Alert.kind == "variance_must"))

    # Quản lý kết luận: thất thoát trong ca → hao hụt ghi muộn gắn với ca và bếp trưởng.
    mgr.post(f"/investigations/{inv['id']}/conclude", {"note": "Bếp trưởng không giải trình được", "allocations": [
        {"cause": "that_thoat_ca", "qty": 900}]})
    late = db.scalar(select(StockTxn).where(StockTxn.txn_type == "waste", StockTxn.late.is_(True)))
    assert float(late.qty) == -900.0 and late.responsible_user_id == ref["beptruong1"] and late.shift_id == shift["id"]
    waste = mgr.get("/reports/waste")
    assert float(waste["late_value"]) == 225000.0


def test_ac11_reweigh_corrected_on_same_handover_does_not_blame_receipt(as_user, ref):
    """Bếp trưởng cân nhầm một lần rồi cân lại khớp và ký: không phải bằng chứng nhập sai."""
    sk, chef = as_user("thukho1"), as_user("beptruong1")
    receive(sk, ref["BO"], 1)
    advance()
    h = sk.post("/handovers", {"kind": "start", "lines": [{"ingredient_id": ref["BO"], "qty": 1000}]})
    line = h["lines"][0]["id"]
    chef._call("POST", f"/handovers/{h['id']}/sign", 409, json={"signer_id": ref["beptruong1"], "pin": "00000", "received": {line: 980}})
    chef._call("POST", f"/handovers/{h['id']}/sign", 200, json={"signer_id": ref["beptruong1"], "pin": "00000", "received": {line: 1000}})
    advance()
    sell(as_user("phucvu1"), as_user("bep1"), ref["BX_dish"], 5)
    advance(60)
    return_shift(sk, current_shift(sk)["id"], {ref["BO"]: 0, ref["RAU"]: 0})
    mgr = as_user("quanly")
    beef = next(i for i in mgr.get("/investigations?status=open") if i["ingredient"]["name"] == "Thịt bò")
    sugg = {s["cause"]: s for s in mgr.get(f"/investigations/{beef['id']}")["suggestions"]}
    assert sugg["nhap_sai"]["level"] == "thấp"
    assert any("cân lại khớp" in e for e in sugg["nhap_sai"]["evidence"])
