"""Tiện ích dùng chung: nhật ký thao tác, cấu hình, mã chứng từ, quy đổi đơn vị."""

import copy
import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import clock
from app.domain import DEFAULT_SETTINGS
from app.errors import Invalid, NotFound
from app.models import AuditLog, Ingredient, Setting, UnitConversion

Q3 = Decimal("0.001")
Q0 = Decimal("1")


def dec(v: Any) -> Decimal:
    return v if isinstance(v, Decimal) else Decimal(str(v))


def q3(v: Decimal) -> Decimal:
    return dec(v).quantize(Q3, rounding=ROUND_HALF_UP)


def money(v: Decimal) -> Decimal:
    return dec(v).quantize(Q0, rounding=ROUND_HALF_UP)


def get_or_404(db: Session, model, obj_id: int, label: str = "Đối tượng"):
    obj = db.get(model, obj_id)
    if obj is None:
        raise NotFound(f"{label} #{obj_id} không tồn tại")
    return obj


def audit(
    db: Session,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    before: Any = None,
    after: Any = None,
    note: str | None = None,
) -> None:
    db.add(
        AuditLog(
            at=clock.now(),
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            before=_jsonable(before),
            after=_jsonable(after),
            note=note,
        )
    )


def _jsonable(v: Any) -> Any:
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    return str(v)


def get_setting(db: Session, key: str) -> Any:
    row = db.get(Setting, key)
    return copy.deepcopy(row.value if row else DEFAULT_SETTINGS[key])


def all_settings(db: Session) -> dict[str, Any]:
    return {k: get_setting(db, k) for k in DEFAULT_SETTINGS}


def set_setting(db: Session, key: str, value: Any) -> None:
    if key not in DEFAULT_SETTINGS:
        raise Invalid(f"Không có cấu hình '{key}'")
    row = db.get(Setting, key)
    if row is None:
        db.add(Setting(key=key, value=value))
    else:
        row.value = value


def assign_code(db: Session, obj, prefix: str) -> None:
    """Gán mã chứng từ dạng PREFIX-yymmdd-id sau khi có id."""
    obj.code = uuid.uuid4().hex[:20]
    db.add(obj)
    db.flush()
    obj.code = f"{prefix}-{clock.local(clock.now()):%y%m%d}-{obj.id:04d}"


def to_base(db: Session, ingredient: Ingredient, qty: Any, unit: str) -> Decimal:
    """Quy đổi về đơn vị cơ sở của nguyên liệu; báo lỗi nếu không quy đổi được (5.1)."""
    qty = dec(qty)
    if unit == ingredient.base_unit:
        return q3(qty)
    factor = conversion_factor(db, ingredient, unit)
    if factor is None:
        raise Invalid(
            f"Không quy đổi được '{unit}' sang '{ingredient.base_unit}' cho {ingredient.name}. "
            "Hãy khai báo quy đổi đơn vị trước."
        )
    return q3(qty * factor)


def conversion_factor(db: Session, ingredient: Ingredient, unit: str) -> Decimal | None:
    if unit == ingredient.base_unit:
        return Decimal(1)
    rows = db.scalars(
        select(UnitConversion).where(
            UnitConversion.unit == unit,
            UnitConversion.base_unit == ingredient.base_unit,
            (UnitConversion.ingredient_id == ingredient.id) | (UnitConversion.ingredient_id.is_(None)),
        )
    ).all()
    specific = [r for r in rows if r.ingredient_id == ingredient.id]
    chosen = specific or rows
    return chosen[0].factor if chosen else None


def units_for(db: Session, ingredient: Ingredient) -> list[str]:
    rows = db.scalars(
        select(UnitConversion.unit).where(
            UnitConversion.base_unit == ingredient.base_unit,
            (UnitConversion.ingredient_id == ingredient.id) | (UnitConversion.ingredient_id.is_(None)),
        )
    ).all()
    return sorted({ingredient.base_unit, *rows})
