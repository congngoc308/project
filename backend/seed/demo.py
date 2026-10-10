"""Sinh 30 ngày dữ liệu demo qua tầng service (không insert thô), để sổ kho luôn nhất quán.

Chạy:  python -m seed.demo            (xóa sạch dữ liệu cũ rồi sinh lại)

Kịch bản lồng trong dữ liệu:
- Phần lớn các ca lệch nhỏ trong ngưỡng; ca chiều của bếp trưởng Trần Đức Hùng thiếu thịt bò đều cùng chiều.
- 14 ngày trước: nhập sai (phiếu ghi 2 kg bò, thực nhận 1,2 kg) → kiểm kê Kho tối → kết luận "nhập sai".
- 9 ngày trước: công thức phở bò sai → kết luận "sai định mức" + phiên bản công thức mới.
- 6 ngày trước: ca chiều mất 400 g bò → kết luận "thất thoát trong ca".
- 4 ngày trước: thiếu rau lớn, phiếu điều tra còn mở → quá hạn.
- 3 ngày trước: bếp báo hết tôm nhầm → kiểm kê xác nhận tìm thấy 200 g.
- Hôm qua: thiếu gà, phiếu điều tra đang mở.
- 25 ngày trước: người kiêm nhiệm vừa nấu vừa cân trả → ca bị đánh dấu không đảm bảo phân tách nhiệm vụ.
Sau khi sinh, đồng hồ demo đặt ở 06:20 hôm nay; ca sáng chưa nhận bàn giao để trình bày trực tiếp.
"""

import random
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select, text

from app import clock, domain as d
from app.db import SessionLocal, engine
from app.models import Ingredient, MenuItem, OrderItem, Shift, User
from app.services import (
    catalog,
    counts,
    handover,
    investigations,
    ledger,
    monitor,
    orders,
    outofstock,
    receiving,
    shifts,
    waste,
)
from seed.base import seed_reference

R = random.Random(42)
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
MIX = [("BX", 0.25), ("PB", 0.22), ("GR", 0.16), ("TX", 0.1), ("RX", 0.12), ("CC", 0.15)]
TABLES = [f"B{i}" for i in range(1, 13)] + ["Mang đi"]
PINS = {"beptruong1": "2221", "beptruong2": "2222"}
TARGET_A = {"BO": 2.0, "GA": 2.6, "TOM": 1.2, "RAU": 3.8}  # kg tồn Kho mong muốn sau khi nhập buổi sáng
# Tồn Kho mong muốn sau khi nhập đầu tuần (số đơn vị mua), đơn vị mua, đơn giá
WEEKLY_C = {"TOI": (2, "kg", 60000), "OT": (0.5, "kg", 80000), "DAU": (6, "chai", 45000),
            "NM": (4, "chai", 30000), "BN": (1, "gói", 40860), "GAO": (14, "kg", 20000)}
PRICE_A = {"BO": 250000, "GA": 120000, "TOM": 300000, "RAU": 30000}


class Ctx:
    def __init__(self, db):
        self.db = db
        self.u = {u.username: u for u in db.scalars(select(User))}
        self.i = {i.code: i for i in db.scalars(select(Ingredient))}
        self.m = {m.code: m for m in db.scalars(select(MenuItem))}

    def at(self, day: date, hh: int, mm: int = 0) -> None:
        t = clock.at_local(day, time(hh, mm))
        if clock.now() and t < clock.now():
            t = clock.now() + timedelta(seconds=1)
        clock.set_fixed(t)


def reset() -> None:
    with engine.begin() as conn:
        tables = conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'")).scalars().all()
        conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
        conn.execute(text("ALTER SEQUENCE kitchen_seq RESTART WITH 1"))


def pick_dish() -> str:
    x, acc = R.random(), 0.0
    for code, p in MIX:
        acc += p
        if x <= acc:
            return code
    return MIX[-1][0]


def receive_a(c: Ctx, day: date, offset: int, wrong_beef: bool = False) -> None:
    sk = c.u["thukho1"] if offset % 2 else c.u["thukho2"]
    lines = []
    for code, target in TARGET_A.items():
        have = (ledger.book(c.db, c.i[code].id, d.KHO) - getattr(c, "phantom", {}).get(code, 0)) / 1000
        qty = max(Decimal(0), Decimal(str(target)) - have)
        qty = (qty * 2).to_integral_value(rounding="ROUND_CEILING") / 2  # làm tròn lên 0,5 kg
        if qty > 0:
            lines.append({"ingredient_id": c.i[code].id, "unit": "kg", "ordered_qty": qty,
                          "unit_price": PRICE_A[code] * (1 + R.uniform(-0.04, 0.04))})
    r = receiving.create(c.db, sk, "Chợ đầu mối Bình Điền", day, lines)
    c.db.flush()
    rec = []
    for ln in r.lines:
        rec.append({"line_id": ln.id, "received_qty": ln.ordered_qty})
    receiving.receive(c.db, sk, r, rec, invoice_image=None)
    if wrong_beef:
        # Phiếu ghi thêm 2 kg bò nhưng thực tế chỉ có 1,2 kg trong kho.
        r2 = receiving.create(c.db, sk, "Lò mổ Tân Phú", day, [
            {"ingredient_id": c.i["BO"].id, "unit": "kg", "ordered_qty": 2, "unit_price": 248000}])
        c.db.flush()
        receiving.receive(c.db, sk, r2, [{"line_id": r2.lines[0].id, "received_qty": 2}])
    c.db.commit()


def receive_c(c: Ctx, day: date) -> None:
    lines = []
    for code, (target, unit, price) in WEEKLY_C.items():
        factor = 1000 if unit == "kg" else {"DAU": 1000, "NM": 500, "BN": 454}[code]
        have = ledger.book(c.db, c.i[code].id, d.KHO) / factor
        qty = (Decimal(str(target)) - have).to_integral_value(rounding="ROUND_CEILING") if unit != "kg" else             ((Decimal(str(target)) - have) * 2).to_integral_value(rounding="ROUND_CEILING") / 2
        if qty > 0:
            lines.append({"ingredient_id": c.i[code].id, "unit": unit, "ordered_qty": qty, "unit_price": price})
    r = receiving.create(c.db, c.u["thukho1"], "Đại lý gia vị Hòa Phát", day, lines)
    c.db.flush()
    receiving.receive(c.db, c.u["thukho1"], r, [{"line_id": ln.id, "received_qty": ln.ordered_qty} for ln in r.lines])
    c.db.commit()


def start_handover(c: Ctx, shift: Shift, chef: User, plan: dict[str, int]) -> None:
    sk = c.u["thukho1"]
    lines = []
    for code, want in plan.items():
        have = ledger.book(c.db, c.i[code].id, d.KHO) - getattr(c, "phantom", {}).get(code, 0)
        qty = min(Decimal(want), max(Decimal(0), have))
        qty = (qty // 10) * 10
        if qty > 0:
            lines.append({"ingredient_id": c.i[code].id, "qty": qty})
    h = handover.create(c.db, sk, "start", lines)
    c.db.flush()
    handover.sign(c.db, sk, h, chef.id, PINS[chef.username], {ln.id: ln.issued_qty for ln in h.lines})
    c.db.commit()


def supplement_if_needed(c: Ctx, chef: User, menu_code: str, qty: int) -> None:
    v = catalog.effective_version(c.db, c.m[menu_code].id)
    need = {ln.ingredient.code: ln.issue_qty_base * qty for ln in v.lines if ln.ingredient.control_group == d.GROUP_A}
    lines = []
    for code, n in need.items():
        if ledger.book(c.db, c.i[code].id, d.BEP) < n + 30:
            kho = ledger.book(c.db, c.i[code].id, d.KHO) - getattr(c, "phantom", {}).get(code, 0)
            q = min(Decimal(500), kho)
            if q >= n:
                lines.append({"ingredient_id": c.i[code].id, "qty": (q // 10) * 10})
    if lines:
        h = handover.create(c.db, c.u["thukho1"], "supplement", lines)
        c.db.flush()
        handover.sign(c.db, c.u["thukho1"], h, chef.id, PINS[chef.username], {ln.id: ln.issued_qty for ln in h.lines})


def available(c: Ctx, menu_code: str) -> bool:
    """Khách chỉ gọi được món khi Bếp + Kho còn đủ nguyên liệu nhóm A (hết thì gọi món khác)."""
    v = catalog.effective_version(c.db, c.m[menu_code].id)
    for ln in v.lines:
        ing = ln.ingredient
        if ing.control_group != d.GROUP_A:
            continue
        have = ledger.book(c.db, ing.id, d.BEP) + ledger.book(c.db, ing.id, d.KHO) - getattr(c, "phantom", {}).get(ing.code, 0)
        if have < ln.issue_qty_base + 30:
            return False
    return True


def run_shift(c: Ctx, day: date, morning: bool, chef: User, offset: int, special: dict) -> Shift:
    db = c.db
    hh = 6 if morning else 14
    c.at(day, hh - 1, 50)
    shift = shifts.shift_for_handover(db, clock.now())
    plan = {"BO": 900, "GA": 1100, "TOM": 450, "RAU": 1500}
    start_handover(c, shift, chef, plan)
    for mi in db.scalars(select(MenuItem)):
        if catalog.active_locks(db, mi.id):
            try:
                catalog.resell(db, chef, mi, "Đã nhận bàn giao đầu ca")
            except Exception:
                pass
    db.commit()

    server = c.u["phucvu1" if morning else "phucvu2"]
    cooks = [c.u["bep1"], c.u["bep2"]] if morning else [c.u["bep3"], c.u["bep2"]]
    if special.get("sod"):
        cooks = [c.u["kiemnhiem"]]
    n_orders = R.randint(14, 22)
    times = sorted(R.uniform(10, 440) for _ in range(n_orders))
    events = []
    for t in times:
        items = [pick_dish() for _ in range(R.choice([1, 1, 2, 2, 3]))]
        events.append((t, "order", items))
    events.sort(key=lambda e: e[0])
    started: list[OrderItem] = []
    pending_out = special.get("false_out_at")
    for t, kind, items in events:
        if pending_out is not None and t > pending_out:
            false_out(c, chef, special)
            pending_out = None
        c.at(day, hh, 0)
        clock.set_fixed(max(clock.now(), clock.at_local(day, time(hh, 0)) + timedelta(minutes=t)))
        sellable = [code for code in items if catalog.is_sellable(db, c.m[code]) and available(c, code)]
        if not sellable:
            continue
        o = orders.create_order(db, server, R.choice(TABLES), [{"menu_item_id": c.m[x].id} for x in sellable])
        db.flush()
        clock.advance(timedelta(minutes=R.uniform(1, 4)))
        for oi in list(o.items):
            code = next(k for k, m in c.m.items() if m.id == oi.menu_item_id)
            supplement_if_needed(c, chef, code, oi.qty)
            orders.start_item(db, R.choice(cooks), oi)
            started.append(oi)
        clock.advance(timedelta(minutes=R.uniform(6, 12)))
        for oi in o.items:
            if oi.status != d.ITEM_COOKING:
                continue
            roll = R.random()
            if roll < 0.02:
                orders.cancel_item(db, oi_actor(c, cooks), oi, "Khách đổi ý sau khi bếp đã nấu", chef.id,
                                   PINS[chef.username])
            elif roll < 0.035:
                orders.remake_item(db, oi_actor(c, cooks), oi, "Món bị mặn, làm lại", chef.id, PINS[chef.username])
            else:
                orders.complete_item(db, R.choice(cooks), oi)
        db.commit()
    # Hoàn tất các món làm lại còn chờ
    for oi in db.scalars(select(OrderItem).where(OrderItem.status == d.ITEM_WAITING, OrderItem.remake_of_id.is_not(None))):
        code = next(k for k, m in c.m.items() if m.id == oi.menu_item_id)
        if not catalog.is_sellable(db, c.m[code]):
            orders.cancel_item(db, R.choice(cooks), oi, "Hết nguyên liệu, khách đổi món")
            continue
        supplement_if_needed(c, chef, code, oi.qty)
        orders.start_item(db, R.choice(cooks), oi)
        orders.complete_item(db, R.choice(cooks), oi)
    if R.random() < 0.35:
        code = R.choice(["BO", "GA", "RAU", "TOM"])
        wt, reason = R.choice([("do_vo_roi", "Rơi khi sơ chế"), ("hong_so_che", "Sơ chế hỏng phần gân"),
                               ("dung_noi_bo", "Bữa nhân viên")])
        slip = waste.create(db, R.choice(cooks), c.i[code], R.choice([15, 20, 30, 35]), "g", wt, reason, d.BEP)
        approver = c.u["beptruong2" if chef.username == "beptruong1" else "beptruong1"]
        if offset != 0:
            waste.approve(db, approver if slip.status == "pending_chef" else c.u["quanly"], slip)
    db.commit()

    # Cân trả cuối ca
    clock.set_fixed(max(clock.now(), shift.planned_end - timedelta(minutes=R.randint(4, 15))))
    counts_in = {}
    for ing in counts.return_ingredients(db, shift):
        book = ledger.book(db, ing.id, d.BEP)
        theo = -ledger.sum_qty(db, ing.id, d.BEP, d.THEORETICAL_TYPES, shift.opened_at, clock.now())
        # Phần lớn ca cân trả khớp sổ; số còn lại lệch ngẫu nhiên nhỏ, không cùng chiều.
        noise = Decimal(0) if R.random() < 0.65 else theo * Decimal(str(R.gauss(0, 0.007)))
        if chef.username == "beptruong2" and ing.code == "BO":
            noise += theo * Decimal("0.022")
        noise += Decimal(special.get("loss", {}).get(ing.code, 0))
        counts_in[ing.id] = max(Decimal(0), (book - noise).quantize(Decimal(1)))
    returner = c.u["kiemnhiem"] if special.get("sod") else c.u["thukho1"]
    counts.submit_return(db, returner, shift, counts_in)
    db.commit()
    return shift


def oi_actor(c: Ctx, cooks):
    return R.choice(cooks)


def false_out(c: Ctx, chef: User, special: dict) -> None:
    """Bếp báo hết tôm khi vẫn còn hàng trong tủ."""
    clock.advance(timedelta(minutes=1))
    outofstock.report_ingredient_out(c.db, c.u["bep1"], c.i["TOM"])
    c.db.commit()
    special["false_out_done"] = True


def end_of_day(c: Ctx, day: date, offset: int) -> None:
    db = c.db
    c.at(day, 22, 15)
    sk = c.u["thukho2"]
    s = counts.create_session(db, sk, d.COUNT_PERIODIC, d.KHO, group=d.GROUP_A)
    db.flush()
    vals = {}
    for ln in s.lines:
        ing = db.get(Ingredient, ln.ingredient_id)
        book = ledger.book(db, ing.id, d.KHO)
        phantom = getattr(c, "phantom", {}).pop(ing.code, 0) if ing.code == "BO" else 0
        noise = Decimal(R.choice([0, 0, 0, 0, 5, -5]))
        vals[ing.id] = max(Decimal(0), book - phantom - noise)
    counts.submit_session(db, sk, s, vals)
    if offset != 0:
        counts.review(db, c.u["quanly"], s)
    if day.weekday() == 6:
        s = counts.create_session(db, sk, d.COUNT_PERIODIC, d.KHO, group=d.GROUP_C)
        db.flush()
        vals = {}
        for ln in s.lines:
            ing = db.get(Ingredient, ln.ingredient_id)
            book = ledger.book(db, ing.id, d.KHO)
            prev = counts.variance.previous_cutoff(db, ing.id, d.KHO, clock.now())
            theo = -ledger.sum_qty(db, ing.id, d.KHO, d.THEORETICAL_TYPES, prev, clock.now())
            pct = Decimal(str(R.uniform(-0.035, 0.035))) if R.random() < 0.5 else Decimal(0)
            if ing.code == "DAU" and -18 <= offset <= -12:
                pct = Decimal("0.14")  # dầu ăn thiếu ở mức cảnh báo
            vals[ing.id] = max(Decimal(0), (book - theo * pct).quantize(Decimal(1)))
        counts.submit_session(db, sk, s, vals)
        counts.review(db, c.u["quanly"], s)
    db.commit()


def conclude_open(c: Ctx, day: date, rules: dict) -> None:
    """Cuối ngày quản lý kết luận các phiếu điều tra theo kịch bản."""
    from app.models import Investigation

    db = c.db
    c.at(day, 22, 40)
    start, _ = clock.day_bounds(day)
    for inv in db.scalars(select(Investigation).where(Investigation.status == "open", Investigation.opened_at >= start)):
        ing = db.get(Ingredient, inv.ingredient_id)
        rule = rules.get(ing.code)
        if rule is None:
            continue
        mgr = c.u["quanly"]
        remaining = inv.variance_qty - inv.settled_qty
        if rule == "bao_het_nham":
            investigations.verify_false_out(db, inv, mgr, min(Decimal(200), remaining), "Kiểm kê tủ mát còn 200 g tôm")
            remaining = inv.variance_qty - inv.settled_qty
            if remaining > 0:
                investigations.conclude(db, inv, mgr, [{"cause": "qua_tay", "qty": remaining}],
                                        "Phần còn lại do bếp cho quá tay trong ca đông khách")
            continue
        alloc = {"cause": rule, "qty": remaining}
        note = {
            "nhap_sai": "Đối chiếu hóa đơn Lò mổ Tân Phú: chỉ giao 1,2 kg, thủ kho nhập theo số đặt 2 kg",
            "cong_thuc_sai": "Phở bò thực tế dùng 35 g/bát, công thức ghi 30 g; đã tạo phiên bản mới",
            "that_thoat_ca": "Bếp trưởng ca không giải trình được 400 g bò; đã lập biên bản",
            "khong_xac_dinh": "Không đủ căn cứ, theo dõi tiếp",
        }[rule]
        if rule == "nhap_sai":
            from app.models import Receipt, ReceiptLine

            rl = db.scalar(select(ReceiptLine).join(Receipt).where(Receipt.supplier == "Lò mổ Tân Phú"))
            alloc["receipt_line_id"] = rl.id
        investigations.conclude(db, inv, mgr, [alloc], note)
        if rule == "cong_thuc_sai":
            v = catalog.effective_version(db, c.m["PB"].id)
            catalog.create_version(db, mgr, c.m["PB"], [
                {"ingredient_id": ln.ingredient_id, "qty": 35 if ln.ingredient.code == "BO" else ln.qty,
                 "unit": ln.unit, "prep_loss_pct": ln.prep_loss_pct} for ln in v.lines
            ], "Đo lại thực tế: mỗi bát phở dùng 35 g bò")
    db.commit()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    reset()
    real_now = datetime.now(clock.VN)
    today = real_now.date()
    first = today - timedelta(days=DAYS)
    clock.set_fixed(clock.at_local(first, time(5, 0)))
    with SessionLocal() as db:
        seed_reference(db)
        db.commit()
        c = Ctx(db)
        for i in range(DAYS):
            day = first + timedelta(days=i)
            offset = (day - today).days
            print(f"  {day:%d/%m}", end="", flush=True)
            c.at(day, 5, 20)
            if day.weekday() == 0 or i == 0:
                receive_c(c, day)
            c.at(day, 5, 30)
            receive_a(c, day, offset, wrong_beef=(offset == -14))
            if offset == -14:
                c.phantom = {"BO": Decimal(800)}
            swap = day.weekday() == 6
            chef_m = c.u["beptruong2" if swap else "beptruong1"]
            chef_a = c.u["beptruong1" if swap else "beptruong2"]
            special_m = {"sod": offset == -25, "loss": {"BO": 180} if offset == -9 else {}}
            special_a = {"loss": {"BO": 400} if offset == -6 else {"RAU": 450} if offset == -4 else
                         {"GA": 350} if offset == -1 else {}}
            if offset == -3:
                special_m["false_out_at"] = 300
            run_shift(c, day, True, chef_m, offset, special_m)
            run_shift(c, day, False, chef_a, offset, special_a)
            end_of_day(c, day, offset)
            rules = {-14: {"BO": "nhap_sai"}, -9: {"BO": "cong_thuc_sai"}, -6: {"BO": "that_thoat_ca"},
                     -3: {"TOM": "bao_het_nham"}}.get(offset + 0, {})
            if rules:
                conclude_open(c, day, rules)
        print()
        # Hôm nay: hàng tươi về lúc 05:30, một phiếu nhập giá tăng chờ duyệt; ca sáng chưa nhận bàn giao.
        c.at(today, 5, 30)
        receive_a(c, today, 0)
        r = receiving.create(db, c.u["thukho2"], "Vựa hải sản Cần Giờ", today, [
            {"ingredient_id": c.i["TOM"].id, "unit": "kg", "ordered_qty": 1, "unit_price": 360000}])
        db.flush()
        receiving.receive(db, c.u["thukho2"], r, [{"line_id": r.lines[0].id, "received_qty": 1}])
        db.commit()
        target = clock.at_local(today, time(6, 20))
        clock.set_fixed(None)
        offset = int((target - clock.now()).total_seconds())
        clock.save_offset(db, offset)
        db.commit()
        monitor.scan(db)
        db.commit()
        bad = ledger.verify_cache(db)
        print(f"Đồng hồ demo: {clock.local(clock.now()):%H:%M %d/%m/%Y} (lệch {offset} giây). Cache tồn lệch: {len(bad)}")


if __name__ == "__main__":
    sys.exit(main())
