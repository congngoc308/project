# Thiết kế giao diện

## Hướng thiết kế (Taste Skill)

Giao diện được làm lại bằng **Taste Skill** ([tasteskill.dev](https://www.tasteskill.dev), repo `Leonxlnx/taste-skill`, bản ngày 08/10/2026).

Skill chính (`design-taste-frontend`) ghi rõ nó **không dành cho dashboard, bảng dữ liệu hay form nhiều bước**. Vì vậy dự án dùng hai phần:
- **`redesign-skill`** cho toàn bộ ứng dụng: quét, chẩn đoán, sửa trên stack hiện có, không viết lại chức năng.
- **Phần landing của skill chính** chỉ cho màn đăng nhập.

Nguyên tắc chống mặc định, bảng kiểm trước khi bàn giao và quy tắc màu, chữ, bo góc của skill chính được áp cho mọi màn.

**Cách hiểu yêu cầu:** làm lại giao diện của một app vận hành bếp cho nhân viên dùng chung máy tính bảng và một quản lý. Giữ nguyên bố cục thông tin và luồng thao tác. Ngôn ngữ hình ảnh hướng tới "dụng cụ bếp chuyên nghiệp, ấm, có chất riêng".

**Ba thang đo của Taste Skill:**

| Thang đo | Mức | Lý do |
|---|---|---|
| `DESIGN_VARIANCE` (độ phá cách bố cục) | 4 | Ứng dụng thao tác hằng ngày: bố cục ổn định, chỉ phá cách ở vài điểm (phiếu bếp, ô số liệu chính, màn đăng nhập). |
| `MOTION_INTENSITY` (mức chuyển động) | 4 | Chỉ chuyển động có lý do: phản hồi khi nhấn, nổi lên khi rê chuột, phiếu món mới nháy viền. Không có hiệu ứng khi mở trang. |
| `VISUAL_DENSITY` (độ dày thông tin) | 5 | Máy tính bảng thưa, màn quản lý dày hơn. |

## Bảng màu, chữ, hình khối

| Token (`src/index.css`) | Giá trị | Dùng cho |
|---|---|---|
| `--primary` (paprika) | `#eb9360`, chữ than 7,4 : 1 | **Màu nhấn duy nhất**: hành động chính (Gửi bếp, Bắt đầu nấu, Ký nhận), đầu phiếu đang nấu |
| `--ink` (than) | `#1c1917` | Chữ, lựa chọn đang chọn, ô số liệu chính, màn hình số khi cân |
| `--paprika-ink` / `--paprika-soft` | `#7c3410` / `#fbeae0` (7,6 : 1) | Ô icon tiêu đề, ảnh đại diện chữ cái |
| `--page` / `--card` | `#f5f5f4` / `#fdfdfc` | Nền đá ấm / bề mặt khối (không dùng trắng tinh) |
| `--muted-foreground` | `#4f4a45` (8 : 1) | Chữ phụ |
| `--destructive` | `#a11d1d` (chữ trắng 7,8 : 1) | Báo hết nguyên liệu, hủy, từ chối |
| `--status-*` | xanh / vàng / đỏ | Trạng thái, luôn kèm icon + chữ |
| `--focus` | `#1c1917`, vàng trên nền tối | Viền focus 3px cách 2px |

**Font:**
- Tiêu đề và số lớn: **Bricolage Grotesque** (tên biến thể trong code: `font-display`).
- Chữ giao diện: **Plus Jakarta Sans**.
- Cả hai đều đủ dấu tiếng Việt, tự host qua `@fontsource-variable`.
- Không dùng Inter (Taste Skill coi Inter là font mặc định quen thuộc của giao diện AI).

**Icon:** Phosphor, nét duotone cho toàn dự án (đặt ở `IconContext` trong `main.tsx`). Các màn import qua `components/icons.tsx`, nên muốn đổi bộ icon chỉ cần sửa một file. Đã gỡ lucide.

**Bo góc:**
- nút / ô nhập: 12px;
- ô chọn / ô món: 16px;
- khối nội dung (lớp `surface`) và hộp thoại: 20px;
- nhãn trạng thái: tròn hẳn.

**Bóng:** bóng ấm rất nhẹ (`--shadow-soft`, `--shadow-lift`) thay cho viền xám. Nền có lớp hạt nhiễu cố định 3,5% để bớt cảm giác phẳng.

## Ảnh thật

Taste Skill yêu cầu dùng ảnh thật thay cho hình vẽ bằng div. Các ảnh dưới đây lấy từ Wikimedia Commons, đã cắt khung, thu nhỏ và đổi sang WebP trong `public/img/`. Bản đã chỉnh sửa giữ nguyên giấy phép gốc.

| File | Dùng ở | Tác giả | Giấy phép | Nguồn |
|---|---|---|---|---|
| `bep-lua.webp` | Màn đăng nhập (đã cắt bỏ phần áo có logo) | romainguy | CC BY-SA 2.0 | [Wok cooking and fire](https://commons.wikimedia.org/wiki/File:Wok_cooking_and_fire_by_romainguy.jpg) |
| `mon-PB.webp` | Phở bò | Kritzolina | CC BY-SA 4.0 | [Phở bò in a German restaurant 02](https://commons.wikimedia.org/wiki/File:Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_02.jpg) |
| `mon-BX.webp` | Bò xào | jules | CC BY 2.0 | [Ginger beef stir fry](https://commons.wikimedia.org/wiki/File:Ginger_beef_stir_fry.jpg) |
| `mon-CC.webp` | Cơm chiên bò | Fumikas Sagisavas | CC0 | [Cumin beef fried rice](https://commons.wikimedia.org/wiki/File:Cumin_beef_fried_rice.jpg) |
| `mon-RX.webp` | Rau cải xào tỏi (ảnh rau muống xào tỏi) | Andy Li | CC0 | [Morning Glory - Pho](https://commons.wikimedia.org/wiki/File:Morning_Glory_-_Pho_2025-07-25.jpg) |
| `mon-TX.webp` | Tôm xào | Jiaqian AirplaneFan | CC BY 3.0 | [Stir-fried shrimp with garlic and vinegar](https://commons.wikimedia.org/wiki/File:Stir-fried_shrimp_with_garlic_and_vinegar_-_panoramio.jpg) |
| `mon-GR.webp` | Gà rang | PattayaPatrol | CC BY-SA 4.0 | [Crispy stir-fried chicken in chili-garlic sauce](https://commons.wikimedia.org/wiki/File:DSC_9654_Crispy_stir-fried_chicken_tossed_in_a_spicy_chili-garlic_sauce_with_scallions_and_dried_red_chilies.jpg) |

Ảnh được ánh xạ theo **mã món** trong `src/lib/photos.ts`. Món mới chưa có ảnh sẽ hiện icon dao nĩa.

## Theo vai trò

| Vai trò | Màn đầu tiên | Điểm nhấn |
|---|---|---|
| Tất cả | Đăng nhập | Ảnh bếp lửa thật bên trái; bên phải mỗi lúc chỉ hiện một bước (chọn người, rồi nhập PIN); dòng vai trò được xuống dòng, không cắt chữ |
| Phục vụ | Đặt món | Ô món có ảnh, món đang khóa chuyển ảnh đen trắng kèm lý do; giỏ món có ảnh thu nhỏ, mép nét đứt như hóa đơn |
| Bếp / bếp trưởng | Danh sách món | Thẻ món kiểu phiếu bếp: đầu phiếu, đường đục lỗ, số lượng nổi bật; phiếu đang nấu có đầu màu paprika; phiếu mới tới nháy viền hai lần |
| Thủ kho | Việc hôm nay | Dòng thời gian 4 bước nối bằng đường dọc; thẻ "Nên làm tiếp" màu than |
| Quản lý | Tổng quan | Sidebar sáng, mục đang chọn nổi lên; ô số liệu chính nền than chữ paprika; dải "Cần xử lý ngay" nổi lên khi rê chuột |

## Quy tắc giữ khi sửa tiếp

- **Một màu nhấn.** Không thêm màu nhấn thứ hai. Màu trạng thái chỉ dùng cho trạng thái.
- **Không dùng dấu gạch dài** "—" hay "–" trong chữ hiển thị (quy tắc của Taste Skill). Ô không có giá trị hiện "-".
- **Dấu chấm giữa "·" tối đa một lần mỗi dòng.** Nhiều mục thì ngăn bằng dấu phẩy.
- **Chữ màu paprika:** không dùng `text-primary` cho chữ trên nền sáng (chỉ đạt 2,3 : 1); dùng `text-paprika-ink`.
- **Khối nội dung** dùng lớp `surface` thay cho `border bg-card`.
- **Hộp thoại:** không dùng `window.prompt` / `window.confirm`; dùng `useAsk()`.
- **Mốc truy cập giữ nguyên:**
  - chữ ≥ 7 : 1;
  - chữ nhỏ nhất 14px (16px trên máy tính bảng);
  - ô bấm ≥ 44px;
  - viền focus 3px;
  - link "Bỏ qua tới nội dung".

**Kiểm định:** axe-core 4.10 (WCAG 2.0/2.1/2.2 AA và WCAG 2 AAA) trên 29 màn của 5 vai trò cho kết quả **0 vi phạm**.

## Lịch sử

1. Flat Design + Minimalism & Swiss (skill UI UX Pro Max, nhóm "Inventory & Stock Management"): nền slate, màu nhấn xanh lục.
2. Accessible & Ethical + Minimalism (demo "Medical Clinic Portal" của UI UX Pro Max): nâng tương phản lên 7 : 1, cỡ chữ, ô bấm, focus. Các mốc này được giữ nguyên ở bản hiện tại.
3. Taste Skill (bản hiện tại): đổi ngôn ngữ hình ảnh, giữ nguyên chức năng và mốc truy cập.
