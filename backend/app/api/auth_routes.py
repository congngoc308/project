from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.auth.security import COOKIE, Unauthorized, check_secret, current_user, make_token, verify_pin
from app.config import settings
from app.db import get_db
from app.models import User
from app.services import shifts
from app.services.common import audit

router = APIRouter(prefix="/auth", tags=["Đăng nhập"])


def user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "full_name": u.full_name, "roles": u.roles,
            "role_labels": [d.ROLES[r] for r in u.roles if r in d.ROLES]}


def _set_cookie(resp: Response, u: User) -> None:
    resp.set_cookie(COOKIE, make_token(u), httponly=True, samesite="lax", max_age=settings.session_hours * 3600)


@router.get("/staff")
def staff(db: Session = Depends(get_db)):
    """Danh sách nhân viên có PIN cho màn đăng nhập trên máy tính bảng dùng chung."""
    users = db.scalars(select(User).where(User.active, User.pin_hash.is_not(None)).order_by(User.full_name))
    return [user_dict(u) for u in users]


class PinLogin(BaseModel):
    user_id: int
    pin: str


@router.post("/pin-login")
def pin_login(body: PinLogin, response: Response, db: Session = Depends(get_db)):
    u = db.get(User, body.user_id)
    if u is None:
        raise Unauthorized("Không tìm thấy nhân viên")
    verify_pin(db, u, body.pin)
    audit(db, u.id, "auth.pin_login", "user", u.id)
    db.commit()
    _set_cookie(response, u)
    return user_dict(u)


class PasswordLogin(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: PasswordLogin, response: Response, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.username == body.username.strip().lower()))
    if u is None or not u.active or not check_secret(body.password, u.password_hash):
        raise Unauthorized("Sai tên đăng nhập hoặc mật khẩu")
    audit(db, u.id, "auth.login", "user", u.id)
    db.commit()
    _set_cookie(response, u)
    return user_dict(u)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    now = clock.now()
    current = shifts.open_shift(db) or shifts.shift_at(db, now)
    db.commit()
    return {
        **user_dict(user),
        "now": now,
        "clock_offset": clock.offset_seconds(),
        "demo_mode": settings.demo_mode,
        "shift": shifts.shift_dict(current),
    }
