from decimal import Decimal

from app.domain import BASE_UNITS


def _num(v: Decimal | float | int, digits: int = 0) -> str:
    s = f"{float(v):,.{digits}f}"
    return s.replace(",", "_").replace(".", ",").replace("_", ".")


def fmt_qty(v, unit: str) -> str:
    v = Decimal(str(v))
    digits = 0 if v == v.to_integral_value() else 1
    return f"{_num(v, digits)} {BASE_UNITS.get(unit, unit)}"


def fmt_money(v) -> str:
    return f"{_num(v or 0)} đ"


def fmt_num(v) -> str:
    """Số gọn kiểu Việt Nam: 0,5 / 1.200 / 2."""
    v = Decimal(str(v))
    if v == v.to_integral_value():
        return _num(v)
    return _num(v, 3).rstrip("0").rstrip(",")
