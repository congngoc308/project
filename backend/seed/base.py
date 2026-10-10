"""Dữ liệu tham chiếu: mẫu ca, quy đổi đơn vị, tài khoản, nguyên liệu, món và công thức.

Dùng chung cho test và cho seed demo. Định lượng bò xào lấy đúng ví dụ trong bản mô tả:
1 phần = 20 g thịt bò + 30 g rau + 5 ml dầu ăn; giá bò 250.000 đ/kg.
"""

from datetime import time
from decimal import Decimal

from sqlalchemy.orm import Session

from app import domain as d
from app.auth.security import hash_secret
from app.models import Ingredient, MenuItem, ShiftTemplate, UnitConversion, User
from app.services import catalog

# Mọi tài khoản demo dùng chung một PIN cho dễ thử (đổi trước khi dùng thật).
DEMO_PIN = "00000"

USERS = [
    # username, họ tên, vai trò, PIN, mật khẩu
    ("quanly", "Lê Minh Quân", [d.MANAGER], DEMO_PIN, "quanly123"),
    ("thukho1", "Phạm Thị Thu", [d.STOREKEEPER], DEMO_PIN, None),
    ("thukho2", "Đỗ Văn Khải", [d.STOREKEEPER], DEMO_PIN, None),
    ("beptruong1", "Nguyễn Văn Bình", [d.HEAD_CHEF, d.KITCHEN], DEMO_PIN, None),
    ("beptruong2", "Trần Đức Hùng", [d.HEAD_CHEF, d.KITCHEN], DEMO_PIN, None),
    ("bep1", "Hoàng Văn Nam", [d.KITCHEN], DEMO_PIN, None),
    ("bep2", "Vũ Thị Lan", [d.KITCHEN], DEMO_PIN, None),
    ("bep3", "Bùi Quốc Tuấn", [d.KITCHEN], DEMO_PIN, None),
    ("phucvu1", "Đặng Thu Trang", [d.SERVER], DEMO_PIN, None),
    ("phucvu2", "Ngô Minh Khoa", [d.SERVER], DEMO_PIN, None),
    ("kiemnhiem", "Lý Văn Sơn", [d.STOREKEEPER], DEMO_PIN, None),
]

# mã, tên, nhóm hàng, nhóm kiểm soát, đơn vị cơ sở, đơn vị mua, hệ số, đơn giá (đ/đơn vị cơ sở), hạn mức hao hụt, tồn tối thiểu
INGREDIENTS = [
    ("BO", "Thịt bò", "Thịt", "A", "g", "kg", 1000, 250, 40, 1000),
    ("GA", "Thịt gà", "Thịt", "A", "g", "kg", 1000, 120, 60, 1500),
    ("TOM", "Tôm", "Hải sản", "A", "g", "kg", 1000, 300, 40, 800),
    ("RAU", "Rau cải", "Rau", "A", "g", "kg", 1000, 30, 100, 2000),
    ("TOI", "Tỏi", "Gia vị", "C", "g", "kg", 1000, 60, 50, 300),
    ("OT", "Ớt", "Gia vị", "C", "g", "kg", 1000, 80, 30, 100),
    ("DAU", "Dầu ăn", "Gia vị", "C", "ml", "chai", 1000, 45, 100, 2000),
    ("NM", "Nước mắm", "Gia vị", "C", "ml", "chai", 500, 60, 50, 500),
    ("BN", "Bột ngọt", "Gia vị", "C", "g", "gói", 454, 90, 30, 200),
    ("GAO", "Gạo", "Hàng khô", "C", "g", "kg", 1000, 20, 200, 5000),
]

# mã, tên, nhóm món, giá, [(mã nguyên liệu, lượng tinh, đơn vị, % hao hụt sơ chế)]
MENU = [
    ("BX", "Bò xào", "Món xào", 65000, [("BO", 20, "g", 0), ("RAU", 30, "g", 0), ("DAU", 5, "ml", 0)]),
    ("PB", "Phở bò", "Món nước", 55000, [("BO", 30, "g", 0), ("RAU", 10, "g", 0), ("NM", 5, "ml", 0)]),
    ("GR", "Gà rang", "Món xào", 60000, [("GA", 108, "g", 10), ("TOI", 5, "g", 0), ("OT", 2, "g", 0),
                                          ("DAU", 10, "ml", 0), ("NM", 5, "ml", 0)]),
    ("TX", "Tôm xào", "Món xào", 85000, [("TOM", 64, "g", 20), ("RAU", 30, "g", 0), ("TOI", 5, "g", 0),
                                          ("DAU", 10, "ml", 0)]),
    ("RX", "Rau cải xào tỏi", "Món rau", 35000, [("RAU", 135, "g", 10), ("TOI", 8, "g", 0), ("DAU", 10, "ml", 0),
                                                  ("BN", 1, "g", 0)]),
    ("CC", "Cơm chiên bò", "Cơm", 55000, [("GAO", 150, "g", 0), ("BO", 20, "g", 0), ("TOI", 3, "g", 0),
                                           ("DAU", 15, "ml", 0), ("NM", 3, "ml", 0)]),
]


def seed_reference(db: Session, fast_hash: bool = False) -> dict[str, object]:
    db.add_all([
        ShiftTemplate(name="Ca sáng", start_time=time(6, 0), end_time=time(14, 0)),
        ShiftTemplate(name="Ca chiều", start_time=time(14, 0), end_time=time(22, 0)),
    ])
    db.add_all([
        UnitConversion(ingredient_id=None, unit="kg", base_unit="g", factor=Decimal(1000)),
        UnitConversion(ingredient_id=None, unit="lạng", base_unit="g", factor=Decimal(100)),
        UnitConversion(ingredient_id=None, unit="l", base_unit="ml", factor=Decimal(1000)),
    ])
    cache: dict[str, str] = {}

    def h(raw: str) -> str:
        # bcrypt chậm có chủ đích; test dùng chung một hash cho mỗi giá trị để chạy nhanh.
        if not fast_hash:
            return hash_secret(raw)
        if raw not in cache:
            cache[raw] = hash_secret(raw)
        return cache[raw]

    out: dict[str, object] = {}
    for username, name, roles, pin, pw in USERS:
        u = User(username=username, full_name=name, roles=roles, pin_hash=h(pin) if pin else None,
                 password_hash=h(pw) if pw else None)
        db.add(u)
        out[username] = u
    db.flush()

    ings: dict[str, Ingredient] = {}
    for code, name, cat, grp, base, pu, factor, cost, limit, min_stock in INGREDIENTS:
        ing = Ingredient(code=code, name=name, category=cat, control_group=grp, base_unit=base, purchase_unit=pu,
                         last_unit_cost=Decimal(cost), waste_limit=Decimal(limit), min_stock=Decimal(min_stock),
                         shelf_life_days=2 if grp == "A" else 180)
        db.add(ing)
        db.flush()
        if pu not in ("kg",):
            db.add(UnitConversion(ingredient_id=ing.id, unit=pu, base_unit=base, factor=Decimal(factor)))
        ings[code] = ing
        out[code] = ing
    db.add(UnitConversion(ingredient_id=ings["RAU"].id, unit="bó", base_unit="g", factor=Decimal(300)))
    db.flush()

    manager = out["quanly"]
    for code, name, cat, price, lines in MENU:
        mi = MenuItem(code=code, name=name, category=cat, price=Decimal(price))
        db.add(mi)
        db.flush()
        catalog.create_version(db, manager, mi, [
            {"ingredient_id": ings[c].id, "qty": q, "unit": u, "prep_loss_pct": loss} for c, q, u, loss in lines
        ], "Công thức ban đầu")
        out[code + "_dish"] = mi
    db.flush()
    return out
