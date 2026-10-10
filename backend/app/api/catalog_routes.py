from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import domain as d
from app.auth.security import current_user, require
from app.db import get_db
from app.errors import Conflict, Invalid
from app.models import Ingredient, MenuItem, RecipeLine, RecipeVersion, UnitConversion, User
from app.services import catalog, ledger
from app.services.common import audit, get_or_404, units_for

router = APIRouter(tags=["Món & nguyên liệu"])
manager = require(d.MANAGER)


class IngredientIn(BaseModel):
    code: str
    name: str
    category: str = ""
    control_group: str
    base_unit: str
    purchase_unit: str
    purchase_factor: Decimal | None = None  # số đơn vị cơ sở trong một đơn vị mua
    last_unit_cost: Decimal = Decimal(0)
    min_stock: Decimal = Decimal(0)
    shelf_life_days: int | None = None
    warn_pct: Decimal | None = None
    warn_abs: Decimal | None = None
    must_pct: Decimal | None = None
    must_abs: Decimal | None = None
    waste_limit: Decimal | None = None
    active: bool = True


FIELDS = ["name", "category", "control_group", "base_unit", "purchase_unit", "last_unit_cost", "min_stock",
          "shelf_life_days", "warn_pct", "warn_abs", "must_pct", "must_abs", "waste_limit", "active"]


def ingredient_dict(db: Session, i: Ingredient, with_stock: bool = False) -> dict:
    out = {"id": i.id, "code": i.code, **{f: getattr(i, f) for f in FIELDS}, "units": units_for(db, i),
           "conversions": [{"id": c.id, "unit": c.unit, "factor": c.factor, "base_unit": c.base_unit,
                            "specific": c.ingredient_id is not None}
                           for c in db.scalars(select(UnitConversion).where(
                               (UnitConversion.ingredient_id == i.id) |
                               ((UnitConversion.ingredient_id.is_(None)) & (UnitConversion.base_unit == i.base_unit))))]}
    if with_stock:
        out["book_kho"] = ledger.book(db, i.id, d.KHO)
        out["book_bep"] = ledger.book(db, i.id, d.BEP)
    return out


def _validate(body: IngredientIn) -> None:
    if body.control_group not in (d.GROUP_A, d.GROUP_C):
        raise Invalid("Nhóm kiểm soát phải là A hoặc C")
    if body.base_unit not in d.BASE_UNITS:
        raise Invalid("Đơn vị cơ sở phải là g, ml hoặc cái")


def _upsert_purchase_conversion(db: Session, i: Ingredient, factor: Decimal | None) -> None:
    if i.purchase_unit == i.base_unit or factor is None:
        return
    conv = db.scalar(select(UnitConversion).where(UnitConversion.ingredient_id == i.id,
                                                  UnitConversion.unit == i.purchase_unit))
    if conv:
        conv.factor = factor
    else:
        db.add(UnitConversion(ingredient_id=i.id, unit=i.purchase_unit, base_unit=i.base_unit, factor=factor))


@router.get("/ingredients")
def list_ingredients(db: Session = Depends(get_db), user: User = Depends(current_user)):
    show = user.has(d.MANAGER)  # chỉ quản lý thấy tồn sổ (kiểm kê mù)
    return [ingredient_dict(db, i, with_stock=show) for i in db.scalars(select(Ingredient).order_by(Ingredient.control_group, Ingredient.name))]


@router.post("/ingredients")
def create_ingredient(body: IngredientIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    _validate(body)
    if db.scalar(select(Ingredient.id).where(Ingredient.code == body.code)):
        raise Conflict("Mã nguyên liệu đã tồn tại")
    i = Ingredient(code=body.code, **{f: getattr(body, f) for f in FIELDS})
    db.add(i)
    db.flush()
    _upsert_purchase_conversion(db, i, body.purchase_factor)
    db.flush()
    if catalog.conversion_missing(db, i):
        raise Invalid(f"Chưa khai báo quy đổi '{i.purchase_unit}' sang '{i.base_unit}'")
    audit(db, actor.id, "ingredient.create", "ingredient", i.id, after=body.model_dump())
    db.commit()
    return ingredient_dict(db, i, True)


@router.put("/ingredients/{ing_id}")
def update_ingredient(ing_id: int, body: IngredientIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    _validate(body)
    i = get_or_404(db, Ingredient, ing_id, "Nguyên liệu")
    before = {f: getattr(i, f) for f in FIELDS}
    if body.base_unit != i.base_unit and db.scalar(select(func.count()).select_from(RecipeLine).where(RecipeLine.ingredient_id == i.id)):
        raise Conflict("Không đổi đơn vị cơ sở của nguyên liệu đã dùng trong công thức")
    for f in FIELDS:
        setattr(i, f, getattr(body, f))
    _upsert_purchase_conversion(db, i, body.purchase_factor)
    db.flush()
    if catalog.conversion_missing(db, i):
        raise Invalid(f"Chưa khai báo quy đổi '{i.purchase_unit}' sang '{i.base_unit}'")
    audit(db, actor.id, "ingredient.update", "ingredient", i.id, before=before, after=body.model_dump())
    db.commit()
    return ingredient_dict(db, i, True)


class ConversionIn(BaseModel):
    unit: str
    factor: Decimal


@router.post("/ingredients/{ing_id}/conversions")
def add_conversion(ing_id: int, body: ConversionIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    i = get_or_404(db, Ingredient, ing_id, "Nguyên liệu")
    if body.factor <= 0 or not body.unit.strip():
        raise Invalid("Quy đổi không hợp lệ")
    conv = db.scalar(select(UnitConversion).where(UnitConversion.ingredient_id == i.id, UnitConversion.unit == body.unit))
    if conv:
        conv.factor = body.factor
    else:
        db.add(UnitConversion(ingredient_id=i.id, unit=body.unit.strip(), base_unit=i.base_unit, factor=body.factor))
    audit(db, actor.id, "ingredient.conversion", "ingredient", i.id, after=body.model_dump())
    db.commit()
    return ingredient_dict(db, i, True)


# ---- Món & công thức ----

class MenuItemIn(BaseModel):
    code: str
    name: str
    category: str = ""
    price: Decimal
    status: str = "selling"


@router.get("/menu-items")
def list_menu(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return [catalog.menu_dict(db, mi, with_recipe=True) for mi in db.scalars(select(MenuItem).order_by(MenuItem.category, MenuItem.name))]


@router.post("/menu-items")
def create_menu_item(body: MenuItemIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    if db.scalar(select(MenuItem.id).where(MenuItem.code == body.code)):
        raise Conflict("Mã món đã tồn tại")
    mi = MenuItem(**body.model_dump())
    db.add(mi)
    db.flush()
    audit(db, actor.id, "menu_item.create", "menu_item", mi.id, after=body.model_dump())
    db.commit()
    return catalog.menu_dict(db, mi, True)


@router.put("/menu-items/{mi_id}")
def update_menu_item(mi_id: int, body: MenuItemIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    mi = get_or_404(db, MenuItem, mi_id, "Món")
    if body.status not in ("selling", "stopped"):
        raise Invalid("Trạng thái món không hợp lệ")
    before = {"name": mi.name, "category": mi.category, "price": mi.price, "status": mi.status}
    mi.name, mi.category, mi.price, mi.status = body.name, body.category, body.price, body.status
    audit(db, actor.id, "menu_item.update", "menu_item", mi.id, before=before, after=body.model_dump())
    db.commit()
    return catalog.menu_dict(db, mi, True)


@router.get("/menu-items/{mi_id}/recipes")
def recipe_history(mi_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    get_or_404(db, MenuItem, mi_id, "Món")
    versions = db.scalars(
        select(RecipeVersion).options(selectinload(RecipeVersion.lines).selectinload(RecipeLine.ingredient))
        .where(RecipeVersion.menu_item_id == mi_id).order_by(RecipeVersion.version_no.desc())
    )
    names = {u.id: u.full_name for u in db.scalars(select(User))}
    current = catalog.effective_version(db, mi_id)
    return [{**catalog.version_dict(v), "created_by_name": names.get(v.created_by),
             "current": current is not None and v.id == current.id} for v in versions]


class RecipeLineIn(BaseModel):
    ingredient_id: int
    qty: Decimal
    unit: str | None = None
    prep_loss_pct: Decimal = Decimal(0)
    note: str = ""


class RecipeIn(BaseModel):
    lines: list[RecipeLineIn]
    reason: str = ""
    effective_from: datetime | None = None


@router.post("/menu-items/{mi_id}/recipes")
def new_recipe_version(mi_id: int, body: RecipeIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    mi = get_or_404(db, MenuItem, mi_id, "Món")
    v = catalog.create_version(db, actor, mi, [ln.model_dump() for ln in body.lines], body.reason, body.effective_from)
    db.commit()
    db.refresh(v)
    return catalog.version_dict(v)


class PreviewIn(BaseModel):
    ingredient_id: int
    qty: Decimal
    unit: str | None = None
    prep_loss_pct: Decimal = Decimal(0)


@router.post("/recipes/preview-line")
def preview_line(body: PreviewIn, db: Session = Depends(get_db), _: User = Depends(manager)):
    """Tính trước lượng xuất kho một phần để hiển thị khi soạn công thức."""
    ing = get_or_404(db, Ingredient, body.ingredient_id, "Nguyên liệu")
    net, issue = catalog.compute_issue(db, ing, body.qty, body.unit or ing.base_unit, body.prep_loss_pct)
    return {"net_qty_base": net, "issue_qty_base": issue, "base_unit": ing.base_unit,
            "cost": issue * ing.last_unit_cost}
