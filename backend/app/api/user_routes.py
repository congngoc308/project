from typing import Any

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import domain as d
from app.api.auth_routes import user_dict
from app.auth.security import current_user, hash_secret, require, validate_pin
from app.db import get_db
from app.errors import Conflict, Invalid
from app.models import User
from app.services.common import all_settings, audit, get_or_404, set_setting

router = APIRouter(tags=["Người dùng & cấu hình"])
manager = require(d.MANAGER)


class UserIn(BaseModel):
    username: str
    full_name: str
    roles: list[str]
    password: str | None = None
    pin: str | None = None
    active: bool = True


def _apply(u: User, body: UserIn) -> None:
    bad = [r for r in body.roles if r not in d.ROLES]
    if bad or not body.roles:
        raise Invalid("Vai trò không hợp lệ")
    u.full_name = body.full_name.strip()
    u.roles = body.roles
    u.active = body.active
    if body.password:
        if len(body.password) < 6:
            raise Invalid("Mật khẩu tối thiểu 6 ký tự")
        u.password_hash = hash_secret(body.password)
    if body.pin:
        validate_pin(body.pin)
        u.pin_hash = hash_secret(body.pin)
        u.failed_pin = 0
        u.locked_until = None


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(manager)):
    return [{**user_dict(u), "active": u.active, "has_pin": bool(u.pin_hash), "has_password": bool(u.password_hash)}
            for u in db.scalars(select(User).order_by(User.full_name))]


@router.post("/users")
def create_user(body: UserIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    name = body.username.strip().lower()
    if db.scalar(select(User.id).where(User.username == name)):
        raise Conflict("Tên đăng nhập đã tồn tại")
    u = User(username=name, full_name="", roles=[])
    _apply(u, body)
    if not u.pin_hash and not u.password_hash:
        raise Invalid("Cần đặt PIN (nhân viên) hoặc mật khẩu (quản lý)")
    db.add(u)
    db.flush()
    audit(db, actor.id, "user.create", "user", u.id, after={"username": name, "roles": body.roles})
    db.commit()
    return user_dict(u)


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UserIn, db: Session = Depends(get_db), actor: User = Depends(manager)):
    u = get_or_404(db, User, user_id, "Người dùng")
    before = {"full_name": u.full_name, "roles": u.roles, "active": u.active}
    _apply(u, body)
    if u.id == actor.id and d.MANAGER not in u.roles:
        raise Invalid("Không thể tự bỏ vai trò quản lý của chính mình")
    audit(db, actor.id, "user.update", "user", u.id, before=before,
          after={"full_name": u.full_name, "roles": u.roles, "active": u.active,
                 "pin_reset": bool(body.pin), "password_reset": bool(body.password)})
    db.commit()
    return user_dict(u)


@router.get("/meta")
def meta(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return {
        "roles": d.ROLES,
        "locations": d.LOCATIONS,
        "base_units": d.BASE_UNITS,
        "txn_types": d.TXN_TYPES,
        "waste_types": {k: {"group": g, "label": lbl} for k, (g, lbl) in d.WASTE_TYPES.items()},
        "manual_waste_types": d.MANUAL_WASTE_TYPES,
        "causes": d.CAUSES,
        "count_kinds": d.COUNT_KINDS,
        "tiers": d.TIERS,
        "item_statuses": d.ITEM_STATUSES,
        "settings": all_settings(db),
    }


@router.put("/settings/{key}")
def put_setting(key: str, value: Any = Body(...), db: Session = Depends(get_db), actor: User = Depends(manager)):
    before = all_settings(db).get(key)
    set_setting(db, key, value)
    audit(db, actor.id, "setting.update", "setting", None, before={key: before}, after={key: value})
    db.commit()
    return all_settings(db)
