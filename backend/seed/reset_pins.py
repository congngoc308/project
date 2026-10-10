"""Đặt lại PIN của các tài khoản demo về PIN chung DEMO_PIN (00000) trong seed.base (không đụng dữ liệu khác).

Chạy: `docker compose exec api python -m seed.reset_pins`. Tài khoản do quản lý tự tạo không nằm trong danh sách
thì giữ nguyên; nếu PIN cũ của họ không đủ 5 số, quản lý đặt lại ở màn Người dùng.
"""

import sys

from sqlalchemy import select

from app.auth.security import hash_secret
from app.db import SessionLocal
from app.models import User
from seed.base import USERS


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    pins = {username: pin for username, _, _, pin, _ in USERS if pin}
    with SessionLocal() as db:
        for u in db.scalars(select(User).where(User.username.in_(pins))):
            u.pin_hash = hash_secret(pins[u.username])
            u.failed_pin = 0
            u.locked_until = None
            print(f"{u.username:<12} {u.full_name:<18} PIN {pins[u.username]}")
        others = db.scalars(select(User.username).where(User.username.not_in(pins), User.pin_hash.is_not(None))).all()
        db.commit()
    if others:
        print("Giữ nguyên PIN (không thuộc dữ liệu demo):", ", ".join(others))


if __name__ == "__main__":
    main()
