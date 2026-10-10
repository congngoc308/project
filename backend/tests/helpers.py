from datetime import timedelta

from app import clock


def advance(minutes: int = 1) -> None:
    clock.advance(timedelta(minutes=minutes))


def receive(storekeeper, ingredient_id: int, qty, unit: str = "kg", price=250000, supplier="Chợ đầu mối",
            received=None, diff_reason=None) -> dict:
    r = storekeeper.post("/receipts", {"supplier": supplier, "lines": [
        {"ingredient_id": ingredient_id, "unit": unit, "ordered_qty": qty, "unit_price": price}]})
    line_id = r["lines"][0]["id"]
    return storekeeper.post(f"/receipts/{r['id']}/receive", {"lines": [
        {"line_id": line_id, "received_qty": qty if received is None else received, "diff_reason": diff_reason}]})


def handover(storekeeper, chef_api, chef_id: int, pin: str, lines: dict[int, float], kind: str = "start",
             received: dict[int, float] | None = None, expect: int = 200) -> dict:
    h = storekeeper.post("/handovers", {"kind": kind, "lines": [
        {"ingredient_id": i, "qty": q} for i, q in lines.items()]})
    by_ing = {ln["ingredient_id"]: ln["id"] for ln in h["lines"]}
    got = received or lines
    res = chef_api._call("POST", f"/handovers/{h['id']}/sign", expect, json={
        "signer_id": chef_id, "pin": pin, "received": {by_ing[i]: q for i, q in got.items()}})
    return {"handover": h, "response": res.json()}


def sell(server, kitchen, menu_item_id: int, n: int, table: str = "B1") -> list[dict]:
    """Tạo đơn n phần (mỗi phần một dòng) và bếp bấm Bắt đầu từng phần."""
    o = server.post("/orders", {"table_label": table, "items": [{"menu_item_id": menu_item_id}] * n})
    for it in o["items"]:
        kitchen.post(f"/kitchen/items/{it['id']}/start")
    return o["items"]


def current_shift(api) -> dict:
    return api.get("/shifts/current")


def return_shift(storekeeper, shift_id: int, counts: dict[int, float], expect: int = 200):
    return storekeeper._call("POST", f"/shifts/{shift_id}/return", expect,
                             json={"counts": {str(k): v for k, v in counts.items()}}).json()
