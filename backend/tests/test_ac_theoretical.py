"""AC-01 → AC-05: nguồn số lý thuyết (đơn, danh sách món của bếp, trừ kho, công thức)."""

from sqlalchemy import select

from app.models import OrderItem, StockTxn
from tests.helpers import advance, handover, receive, sell


def _txns(db, **filters):
    stmt = select(StockTxn)
    for k, v in filters.items():
        stmt = stmt.where(getattr(StockTxn, k) == v)
    return db.scalars(stmt.order_by(StockTxn.id)).all()


def test_ac01_kitchen_list_in_confirmation_order(as_user, ref):
    sv = as_user("phucvu1")
    o1 = sv.post("/orders", {"table_label": "B1", "items": [{"menu_item_id": ref["BX_dish"]}, {"menu_item_id": ref["GR_dish"]}]})
    advance()
    o2 = sv.post("/orders", {"table_label": "B2", "items": [{"menu_item_id": ref["PB_dish"]}]})
    advance()
    sv.post(f"/orders/{o1['id']}/items", {"items": [{"menu_item_id": ref["RX_dish"]}]})
    # Đơn nháp chưa xác nhận thì chưa lên danh sách của bếp.
    draft = sv.post("/orders", {"table_label": "B3", "items": [{"menu_item_id": ref["TX_dish"]}], "confirm": False})

    items = as_user("bep1").get("/kitchen/items")
    assert [(i["table"], i["name"]) for i in items] == [
        ("B1", "Bò xào"), ("B1", "Gà rang"), ("B2", "Phở bò"), ("B1", "Rau cải xào tỏi")]
    assert all(i["order_id"] != draft["id"] for i in items)


def test_ac02_start_deducts_effective_version_done_adds_nothing(as_user, ref, db):
    sv, k, mgr = as_user("phucvu1"), as_user("bep1"), as_user("quanly")
    first = sell(sv, k, ref["BX_dish"], 1)[0]
    bo = _txns(db, ingredient_id=ref["BO"], txn_type="consumption")
    assert [float(t.qty) for t in bo] == [-20.0] and bo[0].location == "bep"
    assert [float(t.qty) for t in _txns(db, ingredient_id=ref["DAU"], txn_type="consumption")] == [-5.0]
    assert _txns(db, ingredient_id=ref["DAU"])[0].location == "kho"  # nhóm C trừ ở Kho

    advance()
    mgr.post(f"/menu-items/{ref['BX_dish']}/recipes", {"reason": "Tăng định lượng bò", "lines": [
        {"ingredient_id": ref["BO"], "qty": 25}, {"ingredient_id": ref["RAU"], "qty": 30},
        {"ingredient_id": ref["DAU"], "qty": 5}]})
    advance()
    second = sell(sv, k, ref["BX_dish"], 1)[0]
    db.expire_all()
    assert [float(t.qty) for t in _txns(db, ingredient_id=ref["BO"], txn_type="consumption")] == [-20.0, -25.0]
    v1 = db.get(OrderItem, first["id"]).recipe_version_id
    v2 = db.get(OrderItem, second["id"]).recipe_version_id
    assert v1 != v2

    before = len(_txns(db))
    k.post(f"/kitchen/items/{second['id']}/done")
    db.expire_all()
    assert len(_txns(db)) == before


def test_ac03_cancel_before_start_no_stock_txn(as_user, ref, db):
    sv = as_user("phucvu1")
    o = sv.post("/orders", {"table_label": "B4", "items": [{"menu_item_id": ref["BX_dish"]}]})
    sv.post(f"/order-items/{o['items'][0]['id']}/cancel", {"reason": "Khách đổi ý"})
    assert _txns(db) == []
    assert sv.get(f"/orders/{o['id']}")["items"][0]["status"] == "cancelled"


def test_ac04_cancel_after_start_needs_chef_and_moves_to_waste(as_user, ref, db):
    sv, k = as_user("phucvu1"), as_user("bep1")
    sk, chef = as_user("thukho1"), as_user("beptruong1")
    receive(sk, ref["BO"], 1)
    handover(sk, chef, ref["beptruong1"], "00000", {ref["BO"]: 1000, ref["RAU"]: 1000})
    advance()
    a, b = sell(sv, k, ref["BX_dish"], 2)

    # Phục vụ không được hủy món đã bắt đầu; bếp phải có bếp trưởng xác nhận bằng PIN.
    sv.post(f"/order-items/{a['id']}/cancel", {"reason": "Khách về"}, expect=403)
    k.post(f"/order-items/{a['id']}/cancel", {"reason": "Khách về"}, expect=400)
    k.post(f"/order-items/{a['id']}/cancel", {"reason": "Khách về", "chef_id": ref["beptruong1"], "chef_pin": "99999"},
           expect=401)
    k.post(f"/order-items/{a['id']}/cancel", {"reason": "Khách về", "chef_id": ref["beptruong1"], "chef_pin": "00000"})
    db.expire_all()
    rev = _txns(db, ingredient_id=ref["BO"], txn_type="consumption_reversal")
    waste = _txns(db, ingredient_id=ref["BO"], txn_type="waste")
    assert [float(t.qty) for t in rev] == [20.0]
    assert [(float(t.qty), t.waste_type) for t in waste] == [(-20.0, "khach_huy_sau_che_bien")]

    # Khai dùng ít hơn định lượng: phần dư trả lại tồn.
    k.post(f"/order-items/{b['id']}/cancel", {"reason": "Khách hủy sớm", "chef_id": ref["beptruong1"],
                                              "chef_pin": "00000", "used_mode": "partial", "used": {ref["BO"]: 8}})
    db.expire_all()
    waste = _txns(db, ingredient_id=ref["BO"], txn_type="waste")
    assert float(waste[-1].qty) == -8.0
    net_b = sum(float(t.qty) for t in db.scalars(select(StockTxn).where(
        StockTxn.source_id.in_([b["id"]]), StockTxn.source_type == "order_item", StockTxn.ingredient_id == ref["BO"])))
    assert net_b == 0.0  # tiêu hao −20 rồi đảo +20; hao hụt −8 nằm ở phiếu hao hụt


def test_ac05_prep_loss_issue_quantity(as_user, ref, db):
    mgr = as_user("quanly")
    pv = mgr.post("/recipes/preview-line", {"ingredient_id": ref["GA"], "qty": 18, "prep_loss_pct": 10})
    assert float(pv["issue_qty_base"]) == 20.0
    mgr.post(f"/menu-items/{ref['GR_dish']}/recipes", {"reason": "Thử hao hụt sơ chế", "lines": [
        {"ingredient_id": ref["GA"], "qty": 18, "prep_loss_pct": 10}]})
    advance()
    sell(as_user("phucvu1"), as_user("bep1"), ref["GR_dish"], 1)
    assert [float(t.qty) for t in _txns(db, ingredient_id=ref["GA"], txn_type="consumption")] == [-20.0]
    # Đơn vị không quy đổi được thì không cho lưu.
    mgr.post(f"/menu-items/{ref['GR_dish']}/recipes", {"reason": "x", "lines": [
        {"ingredient_id": ref["GA"], "qty": 1, "unit": "chai"}]}, expect=400)
