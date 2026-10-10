from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, IdMixin, Money, UnitCost


class StockTxn(IdMixin, Base):
    """Giao dịch kho bất biến. Trigger trong DB chặn UPDATE/DELETE (BR-01)."""

    __tablename__ = "stock_txns"
    __table_args__ = (
        Index("ix_txn_ing_loc_time", "ingredient_id", "location", "occurred_at"),
        Index("ix_txn_shift", "shift_id"),
    )

    occurred_at: Mapped[datetime]
    txn_type: Mapped[str] = mapped_column(String(30))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    location: Mapped[str] = mapped_column(String(10))
    qty: Mapped[Decimal]
    unit_cost: Mapped[Decimal] = mapped_column(UnitCost)
    value: Mapped[Decimal] = mapped_column(Money)
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    source_type: Mapped[str | None] = mapped_column(String(30))
    source_id: Mapped[int | None]
    ref_txn_id: Mapped[int | None] = mapped_column(ForeignKey("stock_txns.id"))
    waste_type: Mapped[str | None] = mapped_column(String(30))
    late: Mapped[bool] = mapped_column(default=False)
    cause: Mapped[str | None] = mapped_column(String(30))
    responsible_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)


class StockBalance(Base):
    """Bản cache của tồn sổ = SUM(stock_txns.qty); khóa dòng khi ghi để chống ghi đồng thời."""

    __tablename__ = "stock_balances"

    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), primary_key=True)
    location: Mapped[str] = mapped_column(String(10), primary_key=True)
    qty: Mapped[Decimal] = mapped_column(default=0)


class Receipt(IdMixin, Base):
    __tablename__ = "receipts"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    supplier: Mapped[str] = mapped_column(String(120))
    order_date: Mapped[date | None]
    received_at: Mapped[datetime | None]
    # draft / received / pending_approval / approved / cancelled
    status: Mapped[str] = mapped_column(String(20), default="draft")
    anomalies: Mapped[list[str]] = mapped_column(JSON, default=list)
    invoice_image: Mapped[str | None] = mapped_column(String(200))
    note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    received_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None]

    lines: Mapped[list["ReceiptLine"]] = relationship(back_populates="receipt", order_by="ReceiptLine.id")


class ReceiptLine(IdMixin, Base):
    __tablename__ = "receipt_lines"

    receipt_id: Mapped[int] = mapped_column(ForeignKey("receipts.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    unit: Mapped[str] = mapped_column(String(20))  # đơn vị mua
    ordered_qty: Mapped[Decimal]
    received_qty: Mapped[Decimal | None]
    unit_price: Mapped[Decimal] = mapped_column(Money)  # đ / đơn vị mua
    expiry_date: Mapped[date | None]
    diff_reason: Mapped[str | None] = mapped_column(Text)
    received_qty_base: Mapped[Decimal | None]
    unit_cost_base: Mapped[Decimal | None] = mapped_column(UnitCost)
    txn_id: Mapped[int | None] = mapped_column(ForeignKey("stock_txns.id"))

    receipt: Mapped[Receipt] = relationship(back_populates="lines")


class Handover(IdMixin, Base):
    __tablename__ = "handovers"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id"))
    kind: Mapped[str] = mapped_column(String(12))  # start / supplement
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending / signed / cancelled
    issued_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    issued_at: Mapped[datetime]
    received_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    signed_at: Mapped[datetime | None]
    mismatch_attempts: Mapped[int] = mapped_column(default=0)
    note: Mapped[str] = mapped_column(Text, default="")

    lines: Mapped[list["HandoverLine"]] = relationship(back_populates="handover", order_by="HandoverLine.id")


class HandoverLine(IdMixin, Base):
    __tablename__ = "handover_lines"

    handover_id: Mapped[int] = mapped_column(ForeignKey("handovers.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    issued_qty: Mapped[Decimal]  # thủ kho cân xuất
    received_qty: Mapped[Decimal | None]  # bếp trưởng cân lại
    last_mismatch_qty: Mapped[Decimal | None]  # số bếp cân lại ở lần ký bị từ chối gần nhất

    handover: Mapped[Handover] = relationship(back_populates="lines")


class WasteSlip(IdMixin, Base):
    __tablename__ = "waste_slips"

    at: Mapped[datetime]
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    location: Mapped[str] = mapped_column(String(10))
    qty: Mapped[Decimal]  # đơn vị cơ sở
    waste_type: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text, default="")
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    order_item_id: Mapped[int | None] = mapped_column(ForeignKey("order_items.id"))
    # pending_chef / pending_manager / approved / rejected
    status: Mapped[str] = mapped_column(String(20))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None]
    txn_id: Mapped[int | None] = mapped_column(ForeignKey("stock_txns.id"))


class CountSession(IdMixin, Base):
    __tablename__ = "count_sessions"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    kind: Mapped[str] = mapped_column(String(20))
    location: Mapped[str] = mapped_column(String(10))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    status: Mapped[str] = mapped_column(String(10), default="open")  # open / locked
    blind: Mapped[bool] = mapped_column(default=True)
    opened_at: Mapped[datetime]
    cutoff_at: Mapped[datetime | None]
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    counted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None]
    corrects_session_id: Mapped[int | None] = mapped_column(ForeignKey("count_sessions.id"))
    investigation_id: Mapped[int | None]
    note: Mapped[str] = mapped_column(Text, default="")

    lines: Mapped[list["CountLine"]] = relationship(back_populates="session", order_by="CountLine.id")


class CountLine(IdMixin, Base):
    __tablename__ = "count_lines"
    __table_args__ = (Index("ix_countline_ing_loc", "ingredient_id", "location", "cutoff_at"),)

    session_id: Mapped[int] = mapped_column(ForeignKey("count_sessions.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    location: Mapped[str] = mapped_column(String(10))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    counted_qty: Mapped[Decimal | None]
    cutoff_at: Mapped[datetime | None]
    period_start: Mapped[datetime | None]
    book_qty: Mapped[Decimal | None]
    theoretical_qty: Mapped[Decimal | None]
    recorded_waste_qty: Mapped[Decimal | None]
    variance_qty: Mapped[Decimal | None]  # tồn sổ − thực đếm; dương = thiếu
    variance_pct: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    unit_cost: Mapped[Decimal | None] = mapped_column(UnitCost)
    variance_value: Mapped[Decimal | None] = mapped_column(Money)
    tier: Mapped[str | None] = mapped_column(String(6))
    responsible_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    txn_id: Mapped[int | None] = mapped_column(ForeignKey("stock_txns.id"))

    session: Mapped[CountSession] = relationship(back_populates="lines")


class Investigation(IdMixin, Base):
    __tablename__ = "investigations"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    count_line_id: Mapped[int] = mapped_column(ForeignKey("count_lines.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    location: Mapped[str] = mapped_column(String(10))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    responsible_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    variance_qty: Mapped[Decimal]
    variance_value: Mapped[Decimal] = mapped_column(Money)
    settled_qty: Mapped[Decimal] = mapped_column(default=0)
    opened_at: Mapped[datetime]
    due_at: Mapped[datetime]
    status: Mapped[str] = mapped_column(String(12), default="open")  # open / concluded
    suggestions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    allocations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    conclusion_note: Mapped[str | None] = mapped_column(Text)
    concluded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    concluded_at: Mapped[datetime | None]
