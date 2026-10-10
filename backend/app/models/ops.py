from datetime import date, datetime, time

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, IdMixin


class ShiftTemplate(IdMixin, Base):
    __tablename__ = "shift_templates"

    name: Mapped[str] = mapped_column(String(40))
    start_time: Mapped[time]
    end_time: Mapped[time]
    active: Mapped[bool] = mapped_column(default=True)


class Shift(IdMixin, Base):
    """Một ca cụ thể. Giờ dự kiến lấy từ mẫu ca; kỳ đo thật là opened_at → closed_at."""

    __tablename__ = "shifts"
    __table_args__ = (UniqueConstraint("template_id", "business_date"),)

    template_id: Mapped[int] = mapped_column(ForeignKey("shift_templates.id"))
    business_date: Mapped[date]
    name: Mapped[str] = mapped_column(String(40))
    planned_start: Mapped[datetime]
    planned_end: Mapped[datetime]
    status: Mapped[str] = mapped_column(String(10), default="planned")  # planned / open / closed
    opened_at: Mapped[datetime | None]
    closed_at: Mapped[datetime | None]
    head_chef_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    sod_violation: Mapped[bool] = mapped_column(default=False)
    sod_notes: Mapped[str] = mapped_column(Text, default="")


class Order(IdMixin, Base):
    __tablename__ = "orders"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    table_label: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(12), default="draft")  # draft/confirmed/done/cancelled
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    opened_at: Mapped[datetime]
    confirmed_at: Mapped[datetime | None]
    cancel_reason: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", order_by="OrderItem.id")


class OrderItem(IdMixin, Base):
    __tablename__ = "order_items"

    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))
    qty: Mapped[int] = mapped_column(default=1)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(14), default="waiting")
    seq: Mapped[int | None]  # thứ tự trên danh sách của bếp = thứ tự xác nhận
    recipe_version_id: Mapped[int | None] = mapped_column(ForeignKey("recipe_versions.id"))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    started_at: Mapped[datetime | None]
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    done_at: Mapped[datetime | None]
    ended_at: Mapped[datetime | None]  # lúc hủy / làm lại / hết nguyên liệu
    ended_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    confirmed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))  # bếp trưởng xác nhận
    end_reason: Mapped[str | None] = mapped_column(Text)
    remake_of_id: Mapped[int | None] = mapped_column(ForeignKey("order_items.id"))
    served_at: Mapped[datetime | None]  # phục vụ xác nhận đã mang món ra bàn (không tác động kho)
    served_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    order: Mapped[Order] = relationship(back_populates="items")
