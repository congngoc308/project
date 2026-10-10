"""Sổ giao dịch kho: nơi duy nhất được ghi biến động tồn.

Mỗi lần ghi khóa dòng stock_balances tương ứng (SELECT … FOR UPDATE) và cập nhật tồn sổ trong
cùng transaction, nên nhiều thiết bị thao tác đồng thời không làm sai tồn (mục 9). Khi một thao
tác ghi nhiều nguyên liệu, gọi lock() trước với toàn bộ cặp (nguyên liệu, vị trí) để khóa theo
thứ tự cố định, tránh deadlock.
"""

from collections.abc import Iterable
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app import clock
from app.models import Ingredient, StockBalance, StockTxn
from app.services.common import dec, money, q3


def lock(db: Session, pairs: Iterable[tuple[int, str]]) -> dict[tuple[int, str], StockBalance]:
    keys = sorted(set(pairs))
    if not keys:
        return {}
    db.execute(
        insert(StockBalance)
        .values([{"ingredient_id": i, "location": loc, "qty": 0} for i, loc in keys])
        .on_conflict_do_nothing()
    )
    out: dict[tuple[int, str], StockBalance] = {}
    for i, loc in keys:
        out[(i, loc)] = db.execute(
            select(StockBalance)
            .where(StockBalance.ingredient_id == i, StockBalance.location == loc)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).scalar_one()
    return out


def book(db: Session, ingredient_id: int, location: str) -> Decimal:
    bal = db.get(StockBalance, (ingredient_id, location))
    return bal.qty if bal else Decimal(0)


def books(db: Session, location: str | None = None) -> dict[tuple[int, str], Decimal]:
    stmt = select(StockBalance)
    if location:
        stmt = stmt.where(StockBalance.location == location)
    return {(b.ingredient_id, b.location): b.qty for b in db.scalars(stmt)}


def post(
    db: Session,
    *,
    txn_type: str,
    ingredient: Ingredient,
    location: str,
    qty: Decimal,
    actor_id: int | None,
    shift_id: int | None = None,
    source: tuple[str, int] | None = None,
    ref_txn_id: int | None = None,
    waste_type: str | None = None,
    late: bool = False,
    cause: str | None = None,
    responsible_user_id: int | None = None,
    approved_by: int | None = None,
    unit_cost: Decimal | None = None,
    note: str | None = None,
    occurred_at: datetime | None = None,
) -> StockTxn:
    qty = q3(dec(qty))
    cost = dec(unit_cost if unit_cost is not None else ingredient.last_unit_cost)
    bal = lock(db, [(ingredient.id, location)])[(ingredient.id, location)]
    bal.qty = q3(bal.qty + qty)
    txn = StockTxn(
        occurred_at=occurred_at or clock.now(),
        txn_type=txn_type,
        ingredient_id=ingredient.id,
        location=location,
        qty=qty,
        unit_cost=cost,
        value=money(qty * cost),
        shift_id=shift_id,
        source_type=source[0] if source else None,
        source_id=source[1] if source else None,
        ref_txn_id=ref_txn_id,
        waste_type=waste_type,
        late=late,
        cause=cause,
        responsible_user_id=responsible_user_id,
        created_by=actor_id,
        approved_by=approved_by,
        note=note,
    )
    db.add(txn)
    db.flush()
    return txn


def sum_qty(
    db: Session,
    ingredient_id: int,
    location: str,
    types: Iterable[str],
    after: datetime | None,
    until: datetime,
    late: bool | None = None,
) -> Decimal:
    stmt = select(func.coalesce(func.sum(StockTxn.qty), 0)).where(
        StockTxn.ingredient_id == ingredient_id,
        StockTxn.location == location,
        StockTxn.txn_type.in_(list(types)),
        StockTxn.occurred_at <= until,
    )
    if after is not None:
        stmt = stmt.where(StockTxn.occurred_at > after)
    if late is not None:
        stmt = stmt.where(StockTxn.late.is_(late))
    return dec(db.scalar(stmt))


def verify_cache(db: Session) -> list[dict]:
    """Đối chiếu bản cache tồn với SUM của sổ giao dịch; trả về các dòng lệch."""
    sums = db.execute(
        select(StockTxn.ingredient_id, StockTxn.location, func.sum(StockTxn.qty)).group_by(
            StockTxn.ingredient_id, StockTxn.location
        )
    ).all()
    cache = books(db)
    bad = []
    for ing, loc, total in sums:
        if q3(dec(total)) != q3(cache.get((ing, loc), Decimal(0))):
            bad.append({"ingredient_id": ing, "location": loc, "ledger": total, "cache": cache.get((ing, loc))})
    return bad
