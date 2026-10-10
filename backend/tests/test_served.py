"""Bước "Đã bưng": phục vụ xác nhận đã mang món ra bàn sau khi bếp hoàn tất. Không tác động kho."""

from sqlalchemy import func, select

from app.models import AuditLog, StockTxn
from tests.helpers import advance, sell


def test_served_flow(as_user, ref, db):
    sv, k = as_user("phucvu1"), as_user("bep1")
    a, b = sell(sv, k, ref["BX_dish"], 2, table="B5")
    # Món đang nấu chưa bưng được.
    sv._call("POST", "/order-items/served", 409, json={"item_ids": [a["id"]]})
    assert sv.get("/server/ready") == []

    advance()
    k.post(f"/kitchen/items/{a['id']}/done")
    k.post(f"/kitchen/items/{b['id']}/done")
    ready = sv.get("/server/ready")
    assert [(i["id"], i["table"], i["served_at"]) for i in ready] == [(a["id"], "B5", None), (b["id"], "B5", None)]

    txns = db.scalar(select(func.count()).select_from(StockTxn))
    advance(2)
    out = sv.post("/order-items/served", {"item_ids": [a["id"], b["id"]]})
    assert all(i["served_at"] for i in out)
    assert sv.get("/server/ready") == []
    # Bếp thấy món đã bưng trong cột "Vừa ra món"; kho không đổi; có nhật ký.
    assert {i["id"]: bool(i["served_at"]) for i in k.get("/kitchen/items") if i["status"] == "done"} == {a["id"]: True, b["id"]: True}
    assert db.scalar(select(func.count()).select_from(StockTxn)) == txns
    assert db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "order_item.served")) == 2

    # Bưng lần hai bị chặn; bếp không có quyền bấm "Đã bưng".
    sv._call("POST", "/order-items/served", 409, json={"item_ids": [a["id"]]})
    k._call("POST", "/order-items/served", 403, json={"item_ids": [b["id"]]})
