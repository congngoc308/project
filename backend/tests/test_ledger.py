"""Bất biến của sổ kho: chỉ ghi thêm, ghi đồng thời không làm sai tồn."""

from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.db import SessionLocal
from app.models import OrderItem, StockBalance, User
from app.services import ledger, orders
from tests.helpers import advance, handover, receive


@pytest.mark.parametrize("table", ["stock_txns", "audit_log"])
def test_append_only_tables_reject_update_and_delete(as_user, ref, db, table):
    receive(as_user("thukho1"), ref["BO"], 1)
    for sql in (f"UPDATE {table} SET id = id", f"DELETE FROM {table}"):
        with pytest.raises(DBAPIError, match="chi duoc ghi them"):
            db.execute(text(sql))
        db.rollback()


def test_concurrent_starts_keep_book_consistent(as_user, ref, db):
    sk = as_user("thukho1")
    receive(sk, ref["BO"], 2)
    receive(sk, ref["RAU"], 2, price=30000)
    handover(sk, as_user("beptruong1"), ref["beptruong1"], "00000", {ref["BO"]: 2000, ref["RAU"]: 2000})
    advance()
    o = as_user("phucvu1").post("/orders", {"table_label": "B9", "items": [{"menu_item_id": ref["BX_dish"]}] * 24})
    ids = [i["id"] for i in o["items"]]

    def start(item_id):
        with SessionLocal() as s:
            orders.start_item(s, s.get(User, ref["bep1"]), s.get(OrderItem, item_id))
            s.commit()

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(start, ids))

    db.expire_all()
    assert float(db.get(StockBalance, (ref["BO"], "bep")).qty) == 2000 - 24 * 20
    assert ledger.verify_cache(db) == []
    assert len(db.scalars(select(OrderItem).where(OrderItem.status == "cooking")).all()) == 24
