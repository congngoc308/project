# Kịch bản trình bày

Khoảng 15–20 phút, bám theo các tiêu chí nghiệm thu AC-01 → AC-18 của bản mô tả v1.5.

## Chuẩn bị

1. `docker compose up -d --build`, sau đó `docker compose exec api python -m seed.demo`. Seed tạo 30 ngày dữ liệu và đặt đồng hồ demo ở **06:20 hôm nay**.
2. Mở hai cửa sổ trình duyệt tại http://localhost:5190:
   - **Cửa sổ "máy tính bảng"** (thu nhỏ khoảng 1024×768) cho phục vụ, bếp và thủ kho. Đổi người bằng nút **Đổi người** rồi chọn tên + PIN. Thủ kho vào thẳng màn **Hôm nay** (4 việc trong ngày theo thứ tự).
   - **Cửa sổ "quản lý"**, đăng nhập `quanly` / `quanly123`.
3. Đổi giờ ở màn **Đồng hồ demo** (menu quản lý). Thanh vàng trên cùng báo đang dùng giờ demo.

## 1. Bức tranh 30 ngày (quản lý)

**Tổng quan**: dải **Cần xử lý ngay** ở trên cùng gom các việc tồn (phiếu quá hạn, ca chưa cân trả, phiếu chờ duyệt…), bấm vào là tới màn xử lý.
- Chênh lệch chưa giải thích được quy ra tiền.
- Phiếu điều tra đang mở: có 1 phiếu **quá hạn** (rau cải thiếu 450 g, ngày −4).
- Tỷ lệ hao hụt ghi đúng lúc so với ghi muộn qua điều tra.
- Cảnh báo **xu hướng**: thịt bò thiếu 3 kỳ liên tiếp tại Bếp, tức thất thoát đều đặn nằm dưới ngưỡng từng ca (AC-15).
- Biểu đồ theo bếp trưởng cho thấy Trần Đức Hùng (ca chiều) thiếu đều. Mỗi biểu đồ có nút **Bảng** để xem số.

**Phiếu điều tra → Đã kết luận**: bốn kiểu tất toán khác nhau.

| Phiếu | Kết luận | Ý nghĩa |
|---|---|---|
| Thịt bò tại Kho, 14 ngày trước | **Nhập sai** | Điều chỉnh có liên kết tới phiếu nhập gốc của Lò mổ Tân Phú; không tính là hao hụt (AC-13) |
| Thịt bò, 9 ngày trước | **Công thức sai** | Ghi "sai định mức" và tạo phiên bản công thức Phở bò v2 (xem Món & công thức → Lịch sử) |
| Thịt bò ca chiều, 6 ngày trước | **Thất thoát trong ca** | Hao hụt ghi muộn, gắn với ca và bếp trưởng |
| Tôm, 3 ngày trước | **Báo hết nhầm** | Kiểm kê xác nhận tìm thấy hàng; phần còn lại kết luận "quá tay" |

**Ca & bàn giao**: ca sáng 25 ngày trước bị đánh dấu **Kiêm nhiệm**. Lý Văn Sơn vừa nấu vừa cân trả, nên ca này "không đảm bảo phân tách nhiệm vụ".

## 2. Kịch bản chính: "1 kg bò, mới 5 bát đã hết" (AC-01, 02, 06, 07, 08, 11)

| Bước | Ai (PIN) | Thao tác | Điểm cần chỉ ra |
|---|---|---|---|
| 1 | Phạm Thị Thu, thủ kho (1111) | **Nhập hàng → Phiếu nhập mới**: Thịt bò 1 kg, đơn giá 250000 → **Lưu phiếu, chờ hàng về** → **Xác nhận đã nhận hàng** | Tồn Kho tăng ngay, đơn giá nhập gần nhất = 250 đ/g (AC-06) |
| 2 | Thủ kho | **Bàn giao → Bàn giao đầu ca**: Thịt bò 1000, Rau cải 1500 → **Tạo phiếu, chuyển bếp trưởng ký** | Màn quản lý: Tổng quan → "Bàn giao đầu ca: Chờ ký". Tồn chưa chuyển sang Bếp (AC-07) |
| 3 | Nguyễn Văn Bình, bếp trưởng (2221), trên máy của thủ kho | Cân lại: nhập **980** cho thịt bò → Ký bằng PIN | Bị từ chối vì lệch quá dung sai 5 g; lần ký lỗi được lưu làm bằng chứng. Thẻ phiếu không hiện số thủ kho cân xuất |
| 4 | Bếp trưởng | Sửa thành **1000** → ký PIN 2221 | Ca sáng chuyển "đang mở", gắn với Nguyễn Văn Bình |
| 5 | Đặng Thu Trang, phục vụ (4441) | **Đặt món**: bàn B3, Bò xào × 5 → **Gửi bếp** | Món hiện ngay trên danh sách của bếp theo thứ tự xác nhận (SSE, AC-01) |
| 6 | Hoàng Văn Nam, bếp (3331) | **Bắt đầu nấu** rồi **Xong, ra món** | Trừ kho khi bắt đầu, hoàn tất không trừ thêm (AC-02). Sổ giao dịch kho: tiêu hao 100 g bò |
| 7 | Quản lý | **Đồng hồ demo → Tới quá giờ kết thúc ca** | Cảnh báo "Ca sáng đã kết thúc mà chưa cân trả" (AC-07) |
| 8 | Thủ kho | **Cân trả cuối ca**: Thịt bò **0**, Rau cải **1350** → **Chốt cân trả & đóng ca** | Màn cân mù: không có tồn sổ (AC-08). Bếp không vào được màn này |
| 9 | Quản lý | **Tổng quan / Cảnh báo** | "Chênh lệch bắt buộc giải trình: Thịt bò tại Bếp" → **900 g ≈ 225.000 đ**, 900% so với lý thuyết 100 g (AC-11) |
| 10 | Quản lý | Mở phiếu điều tra | Gợi ý xếp theo mức khả nghi: **Thất thoát trong ca** (cao), **Nhập sai** thấp vì bếp đã cân đủ 1.000 g lúc nhận, Hao hụt chưa ghi (0 phiếu), lịch sử lệch của bếp trưởng này |
| 11 | Quản lý | Chọn "Thất thoát trong ca", 900 g, ghi căn cứ → **Kết luận & duyệt** | Báo cáo khác → Hao hụt: phần **ghi muộn qua điều tra** tăng 225.000 đ, gắn với ca sáng và Nguyễn Văn Bình |

**Biến thể nhập sai:** ở bước 3, nếu bếp trưởng chỉ cân được 100 g thì không ký được. Lệch được phát hiện ngay lúc bàn giao và thuộc khâu nhập, không đổ cho bếp.

## 3. Báo hết nguyên liệu (AC-12, AC-14)

Làm trước bước 7, trong lúc ca sáng còn mở:
1. Phục vụ đặt thêm **Bò xào** cho bàn B5, chưa nấu.
2. Bếp bấm **Báo hết nguyên liệu → Thịt bò**. Bò xào, Phở bò, Cơm chiên bò bị khóa; món của bàn B5 chuyển "Hết nguyên liệu".
3. Phục vụ, tab **Bàn & thông báo**: toast theo bàn và nút **Đổi món / Hủy món**.
4. Quản lý thấy cảnh báo **"Bếp báo hết Thịt bò khi tồn sổ còn 900 g"** và một phiếu điều tra. Phiếu này **bắt buộc kiểm kê xác nhận** tại Bếp trước khi kết luận (nhập lượng tìm thấy).
5. **Bán lại** chỉ được khi đã có bàn giao bổ sung, phiếu nhập hoặc kiểm kê xác nhận có hàng.
6. **Báo hết món** (ví dụ Cơm chiên bò, lý do "hỏng chảo") chỉ khóa bán, tồn kho không đổi (AC-14).

## 4. Định mức, ngưỡng, báo cáo

- **Món & công thức → Gà rang**: lượng tinh 108 g, hao hụt sơ chế 10% → xuất kho 120 g/phần (AC-05). **Sửa công thức** tạo phiên bản mới có ngày hiệu lực và bắt buộc ghi lý do.
- **Phiếu nhập → Chờ duyệt**: tôm từ Vựa hải sản Cần Giờ, đơn giá lệch +18% so với lần trước (AC-06).
- **Báo cáo AvT** (AC-10, AC-16): lý thuyết, hao hụt đã ghi, thực tế, chênh lệch chưa giải thích (g, %, tiền), mức ngưỡng, phần đã giải trình theo nguyên nhân; sắp theo tiền; lọc theo ngày, ca, vị trí, nguyên liệu; **Xuất Excel**. Các ca bán 49–51 phần/kg nằm trong ngưỡng.
- **Kiểm kê → Hệ thống chọn ngẫu nhiên 2 nguyên liệu nhóm A**: kiểm kê đột xuất không báo trước.

## 5. Kiểm soát và truy vết (AC-17, AC-18)

- **Sổ giao dịch kho**: mỗi dòng có người tạo, người duyệt/ký, người chịu trách nhiệm, chứng từ và giao dịch gốc nếu là điều chỉnh.
- **Nhật ký thao tác**: ai tạo, sửa, hủy đơn; ai sửa công thức; trước → sau. Không ai sửa hay xóa được: DB chặn bằng trigger. Có thể thử bằng `UPDATE stock_txns ...` trong psql.
- Phân quyền chặn ở server:
  - Bếp không mở được màn cân trả.
  - Bếp trưởng đã ký ca không kết luận được phiếu của ca đó.
  - Người tạo phiếu hao hụt không tự duyệt được phiếu của mình.

  Các trường hợp này được kiểm chứng trong `backend/tests/test_ac_control.py`.

## 6. Hạn xử lý

**Đồng hồ demo → +48 giờ**: phiếu điều tra mở ở bước 10 (nếu chưa kết luận) chuyển **Quá hạn** và có cảnh báo.
