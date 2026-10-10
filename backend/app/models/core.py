from datetime import datetime
from typing import Any

from sqlalchemy import ARRAY, JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdMixin


class User(IdMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(50), unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    roles: Mapped[list[str]] = mapped_column(ARRAY(String(20)), default=list)
    password_hash: Mapped[str | None] = mapped_column(String(100))
    pin_hash: Mapped[str | None] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(default=True)
    failed_pin: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None]

    def has(self, *roles: str) -> bool:
        return any(r in self.roles for r in roles)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[Any] = mapped_column(JSON)


class SystemClock(Base):
    __tablename__ = "system_clock"

    id: Mapped[int] = mapped_column(primary_key=True)
    offset_seconds: Mapped[int] = mapped_column(default=0)


class AuditLog(IdMixin, Base):
    """Nhật ký thao tác: chỉ ghi thêm, trigger trong DB chặn sửa/xóa."""

    __tablename__ = "audit_log"

    at: Mapped[datetime]
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[int | None]
    before: Mapped[Any | None] = mapped_column(JSON)
    after: Mapped[Any | None] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(Text)


class Alert(IdMixin, Base):
    __tablename__ = "alerts"

    at: Mapped[datetime]
    kind: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(10))  # info / warn / critical
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str | None] = mapped_column(Text)
    ingredient_id: Mapped[int | None] = mapped_column(ForeignKey("ingredients.id"))
    location: Mapped[str | None] = mapped_column(String(10))
    shift_id: Mapped[int | None] = mapped_column(ForeignKey("shifts.id"))
    ref_type: Mapped[str | None] = mapped_column(String(40))
    ref_id: Mapped[int | None]
    dedupe_key: Mapped[str | None] = mapped_column(String(160), index=True)
    status: Mapped[str] = mapped_column(String(12), default="open")
    resolved_at: Mapped[datetime | None]
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
