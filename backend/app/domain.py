"""Mã và nhãn tiếng Việt của các khái niệm nghiệp vụ (mục 2, 5.2, 5.6, 5.9 của bản mô tả)."""

# Vai trò (mục 4). Một người có thể giữ nhiều vai trò.
SERVER = "server"
KITCHEN = "kitchen"
HEAD_CHEF = "head_chef"
STOREKEEPER = "storekeeper"
MANAGER = "manager"
ROLES = {
    SERVER: "Phục vụ / thu ngân",
    KITCHEN: "Nhân viên bếp",
    HEAD_CHEF: "Bếp trưởng ca",
    STOREKEEPER: "Thủ kho",
    MANAGER: "Quản lý",
}

# Vị trí tồn (mục 2.1)
KHO = "kho"
BEP = "bep"
LOCATIONS = {KHO: "Kho", BEP: "Bếp"}

GROUP_A = "A"
GROUP_C = "C"

BASE_UNITS = {"g": "g", "ml": "ml", "cai": "cái"}

# Loại giao dịch kho (mục 5.2). Dấu của qty: + vào vị trí, − ra khỏi vị trí.
TXN_RECEIPT = "receipt"
TXN_HANDOVER_OUT = "handover_out"
TXN_HANDOVER_IN = "handover_in"
TXN_RETURN_OUT = "return_out"
TXN_RETURN_IN = "return_in"
TXN_CONSUMPTION = "consumption"
TXN_CONSUMPTION_REVERSAL = "consumption_reversal"
TXN_WASTE = "waste"
TXN_WASTE_REVERSAL = "waste_reversal"
TXN_COUNT_ADJUSTMENT = "count_adjustment"
TXN_PENDING_VARIANCE = "pending_variance"
TXN_PENDING_SETTLE = "pending_settle"
TXN_LINKED_ADJUSTMENT = "linked_adjustment"
TXN_RECIPE_VARIANCE = "recipe_variance"
TXN_UNEXPLAINED_LOSS = "unexplained_loss"
TXN_TYPES = {
    TXN_RECEIPT: "Nhập hàng",
    TXN_HANDOVER_OUT: "Bàn giao cho bếp (xuất Kho)",
    TXN_HANDOVER_IN: "Bàn giao cho bếp (nhận ở Bếp)",
    TXN_RETURN_OUT: "Trả về kho (rời Bếp)",
    TXN_RETURN_IN: "Trả về kho (vào Kho)",
    TXN_CONSUMPTION: "Tiêu hao theo công thức",
    TXN_CONSUMPTION_REVERSAL: "Đảo tiêu hao (món hủy / làm lại)",
    TXN_WASTE: "Hao hụt",
    TXN_WASTE_REVERSAL: "Đảo hao hụt (phiếu bị từ chối)",
    TXN_COUNT_ADJUSTMENT: "Điều chỉnh kiểm kê",
    TXN_PENDING_VARIANCE: "Chênh lệch chờ giải trình",
    TXN_PENDING_SETTLE: "Tất toán chênh lệch chờ giải trình",
    TXN_LINKED_ADJUSTMENT: "Điều chỉnh có liên kết",
    TXN_RECIPE_VARIANCE: "Sai định mức",
    TXN_UNEXPLAINED_LOSS: "Thất thoát không rõ nguyên nhân",
}
THEORETICAL_TYPES = (TXN_CONSUMPTION, TXN_CONSUMPTION_REVERSAL)
RECORDED_WASTE_TYPES = (TXN_WASTE, TXN_WASTE_REVERSAL)

# Loại hao hụt (mục 5.6)
WASTE_TYPES = {
    "hong_so_che": ("Chế biến", "Hỏng khi sơ chế"),
    "lam_sai_mon": ("Chế biến", "Làm sai món"),
    "khach_huy_sau_che_bien": ("Chế biến", "Khách hủy sau khi đã chế biến"),
    "lam_lai": ("Chế biến", "Làm lại"),
    "do_vo_roi": ("Sự cố", "Đổ vỡ / rơi"),
    "het_han": ("Sự cố", "Hết hạn"),
    "hong_bao_quan": ("Sự cố", "Hỏng do bảo quản"),
    "dung_noi_bo": ("Chủ động", "Dùng nội bộ (bữa nhân viên)"),
    "tang_khach": ("Chủ động", "Tặng khách / khuyến mãi"),
    "khac": ("Khác", "Khác (bắt buộc ghi chú)"),
    # Chỉ sinh ra khi tất toán phiếu điều tra (ghi muộn).
    "that_thoat_ca": ("Ghi muộn qua điều tra", "Thất thoát trong ca bếp"),
    "hao_hut_chua_ghi": ("Ghi muộn qua điều tra", "Hao hụt chưa ghi"),
    "qua_tay": ("Ghi muộn qua điều tra", "Định lượng tay (quá tay)"),
    "ngoai_he_thong": ("Ghi muộn qua điều tra", "Món làm không qua hệ thống"),
}
MANUAL_WASTE_TYPES = [k for k, (g, _) in WASTE_TYPES.items() if g != "Ghi muộn qua điều tra"]

# Nguyên nhân phiếu điều tra (mục 5.9) và cách tất toán.
CAUSES = {
    "nhap_sai": "Nhập sai",
    "that_thoat_ca": "Thất thoát trong ca bếp",
    "hao_hut_chua_ghi": "Hao hụt chưa ghi",
    "qua_tay": "Định lượng tay (bếp cho quá tay)",
    "cong_thuc_sai": "Công thức / quy đổi sai",
    "kiem_ke_sai": "Kiểm kê trước đó sai",
    "bao_het_nham": "Báo hết nhầm (hàng vẫn còn)",
    "ngoai_he_thong": "Món làm không qua hệ thống",
    "khong_xac_dinh": "Không xác định",
}
CAUSE_TXN = {
    "nhap_sai": TXN_LINKED_ADJUSTMENT,
    "kiem_ke_sai": TXN_LINKED_ADJUSTMENT,
    "cong_thuc_sai": TXN_RECIPE_VARIANCE,
    "that_thoat_ca": TXN_WASTE,
    "hao_hut_chua_ghi": TXN_WASTE,
    "qua_tay": TXN_WASTE,
    "ngoai_he_thong": TXN_WASTE,
    "khong_xac_dinh": TXN_UNEXPLAINED_LOSS,
    "bao_het_nham": TXN_PENDING_SETTLE,
}

# Loại phiên kiểm kê (mục 5.7)
COUNT_SHIFT_RETURN = "shift_return"
COUNT_PERIODIC = "periodic"
COUNT_SPOT = "spot"
COUNT_QUICK_OUT = "quick_out"
COUNT_KINDS = {
    COUNT_SHIFT_RETURN: "Cân trả cuối ca",
    COUNT_PERIODIC: "Kiểm kê định kỳ",
    COUNT_SPOT: "Kiểm kê đột xuất",
    COUNT_QUICK_OUT: "Kiểm kê nhanh khi báo hết",
}

# Tầng ngưỡng (mục 2.4)
TIER_OK = "ok"
TIER_WARN = "warn"
TIER_MUST = "must"
TIERS = {TIER_OK: "Trong ngưỡng", TIER_WARN: "Mức cảnh báo", TIER_MUST: "Bắt buộc duyệt"}

# Trạng thái món trong đơn (mục 5.3)
ITEM_WAITING = "waiting"
ITEM_COOKING = "cooking"
ITEM_DONE = "done"
ITEM_OUT = "out_of_stock"
ITEM_CANCELLED = "cancelled"
ITEM_REMADE = "remade"
ITEM_STATUSES = {
    ITEM_WAITING: "Chờ bếp",
    ITEM_COOKING: "Đang chế biến",
    ITEM_DONE: "Hoàn tất",
    ITEM_OUT: "Hết nguyên liệu",
    ITEM_CANCELLED: "Đã hủy",
    ITEM_REMADE: "Làm lại",
}

# Cấu hình mặc định (sửa được ở màn Cài đặt)
DEFAULT_SETTINGS = {
    "thresholds": {
        GROUP_A: {"warn_pct": 2.5, "warn_abs": 25, "must_pct": 5, "must_abs": 50},
        GROUP_C: {"warn_pct": 10, "warn_abs": 50, "must_pct": 20, "must_abs": 50},
    },
    "investigation_due_hours": 48,
    "handover_tolerance": 5,
    "trend_periods": 3,
    "return_grace_minutes": 30,
    "handover_sign_grace_minutes": 15,
    "receipt_price_tolerance_pct": 15,
    "receipt_history_ratio": 10,
    "cancel_anomaly_min": 3,
}
