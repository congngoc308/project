from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.auth.security import current_user, require
from app.db import get_db
from app.errors import Forbidden
from app.models import Ingredient, MenuItem, Order, OrderItem, User
from app.services import catalog, orders, outofstock
from app.services.common import get_or_404

router = APIRouter(tags=["Đơn & bếp"])
server = require(d.SERVER, d.MANAGER)
kitchen = require(d.KITCHEN, d.HEAD_CHEF, d.MANAGER)
chef_or_manager = require(d.HEAD_CHEF, d.MANAGER)


class ItemIn(BaseModel):
    menu_item_id: int
    qty: int = 1
    note: str = ""


class OrderIn(BaseModel):
    table_label: str
    items: list[ItemIn]
    confirm: bool = True


@router.get("/menu")
def sellable_menu(db: Session = Depends(get_db), _: User = Depends(current_user)):
    """Thực đơn cho màn tạo đơn: món đang bán, kèm trạng thái khóa."""
    return [catalog.menu_dict(db, mi) for mi in db.scalars(
        select(MenuItem).where(MenuItem.status == "selling").order_by(MenuItem.category, MenuItem.name))]


@router.post("/orders")
def create_order(body: OrderIn, db: Session = Depends(get_db), actor: User = Depends(server)):
    o = orders.create_order(db, actor, body.table_label, [i.model_dump() for i in body.items], body.confirm)
    db.commit()
    return orders.order_dict(db, o)


@router.get("/orders")
def list_orders(status: str = "open", db: Session = Depends(get_db), _: User = Depends(current_user)):
    stmt = select(Order).order_by(Order.opened_at.desc()).limit(100)
    if status == "open":
        stmt = stmt.where(Order.status.in_(["draft", "confirmed"]))
    return [orders.order_dict(db, o) for o in db.scalars(stmt)]


@router.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    return orders.order_dict(db, get_or_404(db, Order, order_id, "Đơn"))


@router.post("/orders/{order_id}/confirm")
def confirm(order_id: int, db: Session = Depends(get_db), actor: User = Depends(server)):
    o = orders.confirm_order(db, actor, get_or_404(db, Order, order_id, "Đơn"))
    db.commit()
    return orders.order_dict(db, o)


class AddItemsIn(BaseModel):
    items: list[ItemIn]


@router.post("/orders/{order_id}/items")
def add_items(order_id: int, body: AddItemsIn, db: Session = Depends(get_db), actor: User = Depends(server)):
    o = get_or_404(db, Order, order_id, "Đơn")
    orders.add_items(db, actor, o, [i.model_dump() for i in body.items])
    db.commit()
    return orders.order_dict(db, o)


class ItemUpdate(BaseModel):
    qty: int | None = None
    note: str | None = None


@router.patch("/order-items/{item_id}")
def update_item(item_id: int, body: ItemUpdate, db: Session = Depends(get_db), actor: User = Depends(server)):
    oi = orders.update_item(db, actor, get_or_404(db, OrderItem, item_id, "Món"), body.qty, body.note)
    db.commit()
    return orders.item_dict(db, oi)


class CancelIn(BaseModel):
    reason: str
    chef_id: int | None = None
    chef_pin: str | None = None
    used_mode: str = "full"  # full / partial / unknown
    used: dict[int, Decimal] | None = None


@router.post("/order-items/{item_id}/cancel")
def cancel_item(item_id: int, body: CancelIn, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    oi = get_or_404(db, OrderItem, item_id, "Món")
    if not actor.has(d.SERVER, d.KITCHEN, d.HEAD_CHEF, d.MANAGER):
        raise Forbidden("Bạn không có quyền hủy món")
    orders.cancel_item(db, actor, oi, body.reason, body.chef_id, body.chef_pin, body.used_mode, body.used)
    db.commit()
    return orders.item_dict(db, oi)


@router.get("/kitchen/items")
def kitchen_items(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return orders.kitchen_list(db)


@router.post("/kitchen/items/{item_id}/start")
def start(item_id: int, db: Session = Depends(get_db), actor: User = Depends(kitchen)):
    oi = orders.start_item(db, actor, get_or_404(db, OrderItem, item_id, "Món"))
    db.commit()
    return orders.item_dict(db, oi)


@router.post("/kitchen/items/{item_id}/done")
def done(item_id: int, db: Session = Depends(get_db), actor: User = Depends(kitchen)):
    oi = orders.complete_item(db, actor, get_or_404(db, OrderItem, item_id, "Món"))
    db.commit()
    return orders.item_dict(db, oi)


class RemakeIn(BaseModel):
    reason: str
    chef_id: int
    chef_pin: str


@router.post("/kitchen/items/{item_id}/remake")
def remake(item_id: int, body: RemakeIn, db: Session = Depends(get_db), actor: User = Depends(kitchen)):
    new = orders.remake_item(db, actor, get_or_404(db, OrderItem, item_id, "Món"), body.reason, body.chef_id, body.chef_pin)
    db.commit()
    return orders.item_dict(db, new)


class IngredientOutIn(BaseModel):
    ingredient_id: int


@router.post("/kitchen/out-of-ingredient")
def ingredient_out(body: IngredientOutIn, db: Session = Depends(get_db), actor: User = Depends(kitchen)):
    res = outofstock.report_ingredient_out(db, actor, get_or_404(db, Ingredient, body.ingredient_id, "Nguyên liệu"))
    db.commit()
    return res


class DishOutIn(BaseModel):
    menu_item_id: int
    reason: str


@router.post("/menu/out-of-dish")
def dish_out(body: DishOutIn, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if not actor.has(d.SERVER, d.KITCHEN, d.HEAD_CHEF, d.MANAGER):
        raise Forbidden("Bạn không có quyền báo hết món")
    res = outofstock.report_dish_out(db, actor, get_or_404(db, MenuItem, body.menu_item_id, "Món"), body.reason)
    db.commit()
    return res


class ResellIn(BaseModel):
    note: str = ""


@router.post("/menu-items/{mi_id}/resell")
def resell(mi_id: int, body: ResellIn, db: Session = Depends(get_db), actor: User = Depends(chef_or_manager)):
    mi = get_or_404(db, MenuItem, mi_id, "Món")
    catalog.resell(db, actor, mi, body.note)
    db.commit()
    return catalog.menu_dict(db, mi)


@router.get("/kitchen/out-ingredients")
def out_candidates(db: Session = Depends(get_db), _: User = Depends(kitchen)):
    """Nguyên liệu nhóm A bếp có thể báo hết (không kèm tồn sổ)."""
    return [{"id": i.id, "name": i.name, "unit": i.base_unit} for i in db.scalars(
        select(Ingredient).where(Ingredient.control_group == d.GROUP_A, Ingredient.active).order_by(Ingredient.name))]


@router.get("/server/notifications")
def server_notifications(db: Session = Depends(get_db), _: User = Depends(current_user)):
    """Món đã chuyển 'Hết nguyên liệu' theo bàn để phục vụ đổi món hoặc hủy với khách."""
    items = db.scalars(select(OrderItem).where(OrderItem.status == d.ITEM_OUT).order_by(OrderItem.ended_at.desc()))
    return [orders.item_dict(db, oi) for oi in items]


@router.get("/server/ready")
def server_ready(db: Session = Depends(get_db), _: User = Depends(current_user)):
    """Món đã xong, chờ phục vụ mang ra bàn."""
    return orders.ready_to_serve(db)


class ServedIn(BaseModel):
    item_ids: list[int]


@router.post("/order-items/served")
def mark_served(body: ServedIn, db: Session = Depends(get_db), actor: User = Depends(server)):
    items = [get_or_404(db, OrderItem, i, "Món") for i in dict.fromkeys(body.item_ids)]
    orders.serve_items(db, actor, items)
    db.commit()
    return [orders.item_dict(db, oi) for oi in items]


@router.get("/time")
def time_now():
    return {"now": clock.now(), "offset": clock.offset_seconds()}
