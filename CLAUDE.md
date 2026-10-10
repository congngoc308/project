# CLAUDE.md — Quản lý vận hành bếp

Đồ án theo bản mô tả "Hệ thống quản lý vận hành bếp v1.5" (trọng tâm: kiểm soát thất thoát AvT, phân tách nhiệm vụ, buộc giải trình). Đọc README.md để chạy dự án.

## Bất biến phải giữ

1. **Mọi biến động tồn đi qua `app/services/ledger.py`** (`ledger.post`). Không tạo `StockTxn` hay sửa `StockBalance` ở chỗ khác. Ghi nhiều nguyên liệu trong một thao tác thì gọi `ledger.lock(...)` trước để khóa theo thứ tự cố định.
2. **`stock_txns` và `audit_log` chỉ ghi thêm.** Trigger DB chặn UPDATE/DELETE (migration 0001). Sửa sai = giao dịch mới có `ref_txn_id` trỏ về bản gốc (điều chỉnh có liên kết, đảo tiêu hao, đảo hao hụt, tất toán).
3. **Giờ nghiệp vụ chỉ lấy từ `app.clock.now()`**, không gọi `datetime.now()`. Ngoại lệ: thời hạn phiên đăng nhập và khóa PIN dùng giờ thật (`auth/security.py`), để tua giờ demo không đăng xuất mọi người.
4. **Kiểm kê mù:** không trả tồn sổ / chênh lệch về thiết bị của người đếm hoặc của bếp. `counts.session_dict` chỉ lộ số liệu cho quản lý và chỉ khi phiên đã chốt; `GET /stock` chỉ quản lý; `GET /handovers` ẩn số cân xuất với bếp trưởng; phản hồi báo hết nguyên liệu không có tồn sổ.
5. **Công thức chênh lệch** nằm ở `services/variance.py`: chênh lệch = tồn sổ lúc chốt − thực đếm (dương = thiếu); kỳ đo = từ lần đếm trước của cùng nguyên liệu, cùng vị trí; lý thuyết = −Σ(consumption + consumption_reversal) trong kỳ. Ngưỡng hai tầng: vượt khi vượt cả % lẫn mức tuyệt đối; lý thuyết = 0 thì chỉ xét tuyệt đối.
6. **Tất toán phiếu điều tra là phân loại lại, tồn không đổi**: mỗi phần phân bổ = `pending_settle` (+q) + giao dịch theo nguyên nhân (−q). Riêng “báo hết nhầm” chỉ có phần đảo (+found).
7. **Trừ kho khi món chuyển Đang chế biến**, theo phiên bản công thức hiệu lực lúc đó (lưu `recipe_version_id`). Nhóm A trừ ở Bếp, nhóm C trừ ở Kho. Hoàn tất không tác động kho.
8. **Phân quyền kiểm tra ở server** (`require(...)` + kiểm tra trong service). Người đã ký nhận ca / người đếm không được kết luận phiếu của ca đó. Kiêm nhiệm được phép nhưng đánh dấu `shift.sod_violation`.
9. **SSE chạy trong tiến trình** (`app/events.py`, phát sau commit): chạy uvicorn 1 worker. Muốn nhiều worker thì chuyển sang Postgres LISTEN/NOTIFY.

## Lệnh thường dùng

- Test backend: `cd backend && .venv/Scripts/python -m pytest` (cần `docker compose up -d db-test`, cổng 5451).
- Seed demo: `cd backend && .venv/Scripts/python -m seed.demo [số_ngày]` (xóa sạch dữ liệu cũ).
- Migration mới: `cd backend && .venv/Scripts/alembic revision --autogenerate -m "..."`.
- Frontend: `cd frontend && npx tsc -b && npm run build`; dev server `npm run dev` (cổng 5190).

## Quy ước

- Giao diện, thông báo lỗi, chú thích code bằng tiếng Việt; mã nghiệp vụ (enum) bằng tiếng Anh trong `app/domain.py` kèm nhãn tiếng Việt.
- Số lượng lưu theo đơn vị cơ sở (g / ml / cái) kiểu `NUMERIC(14,3)`; tiền VND; đơn giá theo đ / đơn vị cơ sở.
- Biểu đồ quản lý theo skill dataviz: cột mảnh, lưới mảnh liền nét, mức ngưỡng luôn có icon + nhãn, mỗi biểu đồ có chế độ xem bảng.
- Giao diện theo `docs/GIAO_DIEN.md` (Taste Skill: một màu nhấn paprika, nền đá ấm, Bricolage Grotesque + Plus Jakarta Sans, icon Phosphor qua `components/icons.tsx`, khối dùng lớp `surface`, không dấu gạch dài trong chữ hiển thị). Giữ mốc truy cập: chữ ≥ 7:1, cỡ nhỏ nhất 14px, ô bấm ≥ 44px, focus 3px; kiểm bằng axe-core. Không dùng `window.prompt/confirm`: dùng `useAsk()`. Ảnh món ánh xạ theo mã trong `lib/photos.ts`, ghi công ở `docs/GIAO_DIEN.md`.
- Cổng 5180 trên máy này đang bị một prototype khác dùng, nên web chạy ở 5190.
