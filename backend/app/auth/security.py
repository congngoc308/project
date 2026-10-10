"""Mật khẩu, PIN và phiên đăng nhập.

Thời hạn phiên và khóa PIN dùng giờ thật (không theo đồng hồ demo), để tua giờ khi trình bày
không đăng xuất mọi người.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import DomainError, Forbidden, Invalid
from app.models import User

COOKIE = "qlb_session"
MAX_PIN_FAILS = 5
PIN_LOCK_MINUTES = 5


class Unauthorized(DomainError):
    status_code = 401


def hash_secret(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt(rounds=10)).decode()


def check_secret(raw: str, hashed: str | None) -> bool:
    return bool(hashed) and bcrypt.checkpw(raw.encode(), hashed.encode())


def validate_pin(pin: str) -> None:
    if not (pin.isdigit() and 4 <= len(pin) <= 6):
        raise Invalid("PIN phải gồm 4–6 chữ số")


def make_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.session_hours)
    return jwt.encode({"sub": str(user.id), "exp": exp}, settings.secret_key, algorithm="HS256")


def verify_pin(db: Session, user: User, pin: str) -> None:
    """Kiểm tra PIN, khóa tạm sau nhiều lần sai. Dùng cho đăng nhập và ký nhận."""
    real_now = datetime.now(timezone.utc)
    if not user.active:
        raise Forbidden("Tài khoản đã bị khóa")
    if user.locked_until and user.locked_until > real_now:
        raise Forbidden(f"Nhập sai PIN quá {MAX_PIN_FAILS} lần, thử lại sau ít phút")
    if not check_secret(pin, user.pin_hash):
        user.failed_pin += 1
        if user.failed_pin >= MAX_PIN_FAILS:
            user.locked_until = real_now + timedelta(minutes=PIN_LOCK_MINUTES)
            user.failed_pin = 0
        db.commit()
        raise Unauthorized(f"PIN của {user.full_name} không đúng")
    user.failed_pin = 0
    user.locked_until = None


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE)
    if not token:
        raise Unauthorized("Chưa đăng nhập")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise Unauthorized("Phiên đăng nhập đã hết hạn")
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.active:
        raise Unauthorized("Tài khoản không còn hoạt động")
    return user


def require(*roles: str):
    """Dependency kiểm tra vai trò ở phía máy chủ (mục 9)."""

    def dep(user: User = Depends(current_user)) -> User:
        if not user.has(*roles):
            raise Forbidden("Bạn không có quyền thực hiện thao tác này")
        return user

    return dep
