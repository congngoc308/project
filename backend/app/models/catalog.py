from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, IdMixin, Money, UnitCost


class Ingredient(IdMixin, Base):
    __tablename__ = "ingredients"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), default="")
    control_group: Mapped[str] = mapped_column(String(1))  # A / C
    base_unit: Mapped[str] = mapped_column(String(8))  # g / ml / cai
    purchase_unit: Mapped[str] = mapped_column(String(20))
    last_unit_cost: Mapped[Decimal] = mapped_column(UnitCost, default=0)  # đ / đơn vị cơ sở
    min_stock: Mapped[Decimal] = mapped_column(default=0)
    shelf_life_days: Mapped[int | None]
    warn_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    warn_abs: Mapped[Decimal | None]
    must_pct: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    must_abs: Mapped[Decimal | None]
    waste_limit: Mapped[Decimal | None]  # hạn mức một phiếu hao hụt
    active: Mapped[bool] = mapped_column(default=True)


class UnitConversion(IdMixin, Base):
    """Quy đổi đơn vị về đơn vị cơ sở. ingredient_id rỗng = quy đổi chung (kg→g, l→ml)."""

    __tablename__ = "unit_conversions"
    __table_args__ = (UniqueConstraint("ingredient_id", "unit", "base_unit"),)

    ingredient_id: Mapped[int | None] = mapped_column(ForeignKey("ingredients.id"))
    unit: Mapped[str] = mapped_column(String(20))
    base_unit: Mapped[str] = mapped_column(String(8))
    factor: Mapped[Decimal] = mapped_column(Numeric(14, 4))


class MenuItem(IdMixin, Base):
    __tablename__ = "menu_items"

    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), default="")
    price: Mapped[Decimal] = mapped_column(Money, default=0)
    status: Mapped[str] = mapped_column(String(12), default="selling")  # selling / stopped


class MenuLock(IdMixin, Base):
    """Khóa bán một món: do báo hết món (ingredient_id rỗng) hoặc do hết nguyên liệu."""

    __tablename__ = "menu_locks"

    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))
    ingredient_id: Mapped[int | None] = mapped_column(ForeignKey("ingredients.id"))
    reason: Mapped[str] = mapped_column(Text)
    locked_at: Mapped[datetime]
    locked_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    released_at: Mapped[datetime | None]
    released_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    release_note: Mapped[str | None] = mapped_column(Text)


class RecipeVersion(IdMixin, Base):
    __tablename__ = "recipe_versions"
    __table_args__ = (UniqueConstraint("menu_item_id", "version_no"),)

    menu_item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"))
    version_no: Mapped[int]
    effective_from: Mapped[datetime]
    reason: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    lines: Mapped[list["RecipeLine"]] = relationship(
        back_populates="version", order_by="RecipeLine.id", cascade="all, delete-orphan"
    )


class RecipeLine(IdMixin, Base):
    __tablename__ = "recipe_lines"

    recipe_version_id: Mapped[int] = mapped_column(ForeignKey("recipe_versions.id"))
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"))
    qty: Mapped[Decimal]  # lượng tinh cho một phần, theo `unit`
    unit: Mapped[str] = mapped_column(String(20))
    prep_loss_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    note: Mapped[str] = mapped_column(Text, default="")
    net_qty_base: Mapped[Decimal]
    issue_qty_base: Mapped[Decimal]  # lượng xuất kho = tinh ÷ (1 − hao hụt sơ chế)

    version: Mapped[RecipeVersion] = relationship(back_populates="lines")
    ingredient: Mapped[Ingredient] = relationship()
