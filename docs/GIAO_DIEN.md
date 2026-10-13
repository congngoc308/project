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
| `bep-lua.webp` | Màn đăng nhập, khối cuối landing page (đã cắt bỏ phần áo có logo) | romainguy | CC BY-SA 2.0 | [Wok cooking and fire](https://commons.wikimedia.org/wiki/File:Wok_cooking_and_fire_by_romainguy.jpg) |
| `mon-PB.webp` | Phở bò | Kritzolina | CC BY-SA 4.0 | [Phở bò in a German restaurant 02](https://commons.wikimedia.org/wiki/File:Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_02.jpg) |
| `mon-BX.webp` | Bò xào | jules | CC BY 2.0 | [Ginger beef stir fry](https://commons.wikimedia.org/wiki/File:Ginger_beef_stir_fry.jpg) |
| `mon-CC.webp` | Cơm chiên bò | Fumikas Sagisavas | CC0 | [Cumin beef fried rice](https://commons.wikimedia.org/wiki/File:Cumin_beef_fried_rice.jpg) |
| `mon-RX.webp` | Rau cải xào tỏi (ảnh rau muống xào tỏi) | Andy Li | CC0 | [Morning Glory - Pho](https://commons.wikimedia.org/wiki/File:Morning_Glory_-_Pho_2025-07-25.jpg) |
| `mon-TX.webp` | Tôm xào | Jiaqian AirplaneFan | CC BY 3.0 | [Stir-fried shrimp with garlic and vinegar](https://commons.wikimedia.org/wiki/File:Stir-fried_shrimp_with_garlic_and_vinegar_-_panoramio.jpg) |
| `mon-GR.webp` | Gà rang | PattayaPatrol | CC BY-SA 4.0 | [Crispy stir-fried chicken in chili-garlic sauce](https://commons.wikimedia.org/wiki/File:DSC_9654_Crispy_stir-fried_chicken_tossed_in_a_spicy_chili-garlic_sauce_with_scallions_and_dried_red_chilies.jpg) |
| `landing/bep-dem.webp` | Landing page, phần mở đầu | Takeaway | CC BY-SA 3.0 | [Chiang Mai restaurant kitchen](https://commons.wikimedia.org/wiki/File:Chiang_Mai_restaurant_kitchen.JPG) |
| `landing/bo-thai.webp` | Landing page, bước "Nhập kho" | J. Samuel Burner | CC BY 2.0 | [Raw beef slices](https://commons.wikimedia.org/wiki/File:Raw_beef_slices.jpg) |
| `landing/can-bep.webp` | Landing page, "Cân trả" và ô "Đếm mù" (đã cắt khung) | Jacek Halicki | CC BY-SA 4.0 | [2023 Elektroniczna waga kuchenna](https://commons.wikimedia.org/wiki/File:2023_Elektroniczna_waga_kuchenna.jpg) |

Ảnh được ánh xạ theo **mã món** trong `src/lib/photos.ts`. Món mới chưa có ảnh sẽ hiện icon dao nĩa.

## Theo vai trò

| Vai trò | Màn đầu tiên | Điểm nhấn |
|---|---|---|
| Tất cả | Đăng nhập | Ảnh bếp lửa thật bên trái; bên phải mỗi lúc chỉ hiện một bước (chọn người, rồi nhập PIN) và focus chuyển về tiêu đề bước mới. Thẻ người chỉ ghi vai trò thêm (bếp trưởng ca, kiêm nhiệm). PIN cố định 5 số trong khối `surface`: đủ 5 số là tự gửi (không có phím **Vào**), gõ được bằng bàn phím (số, Backspace, Esc), sai PIN thì ô PIN lắc một lần kèm dòng báo lỗi. Nút "Quản lý dùng mật khẩu" nằm cạnh tiêu đề; form mật khẩu có nút hiện/ẩn |
| Phục vụ | Đặt món | Ô món có ảnh, món đang khóa chuyển ảnh đen trắng kèm lý do; giỏ món có ảnh thu nhỏ, mép nét đứt như hóa đơn. Bếp bấm "Xong" thì máy phục vụ kêu chuông và hiện thông báo (gộp theo bàn trong 1,5 giây); tab "Bàn & báo khách" đếm cả món chờ bưng; khối "Món đã xong, mang ra bàn" gộp theo bàn, bấm "Đã bưng" từng món hoặc cả bàn, chờ quá 5 phút thì viền hồng kèm icon cảnh báo |
| Bếp / bếp trưởng | Danh sách món | Theo thiết kế "Nhan vien Bep v4" (Claude Design), code ở `layouts/KitchenBits.tsx`. Thanh bên trắng 264px: tab lớn, số việc chờ gắn ở góc icon (nảy lên khi đổi số), bếp trưởng có avatar cam và huy hiệu "Bếp trưởng ca", đồng hồ to, ca hiện tại, âm báo bật/tắt, đổi người. Bảng 3 cột Chờ nấu (xanh) / Đang nấu (cam) / Vừa ra món (xanh lá) kèm món hết nguyên liệu. Phiếu bếp: đầu phiếu màu theo trạng thái (trễ quá 20 phút thì đỏ, viền đập), đường đục lỗ, ảnh món, số lượng nền than. Phiếu đổi cột trượt kiểu FLIP; món mới nháy viền, có chuông và thông báo nền than góc phải dưới. Hủy / làm lại món đang nấu: một hộp thoại hai bước, bước 2 là bàn phím PIN của bếp trưởng ca. Bếp trưởng ca: hai thẻ việc trên bảng món (ký bàn giao, duyệt hao hụt), nút "Bán lại" trên món đang khóa, màn Nhận bàn giao (chọn phiếu, tự cân lại từng dòng bằng bàn phím số, ký PIN của chính mình trong hộp thoại), khối "Chờ bạn duyệt" đầu màn hao hụt với hộp thoại từ chối có lý do. Màn hao hụt: 4 bước đánh số, bàn phím số dính bên phải. Huy hiệu số và "Bếp trưởng ca" dùng nền `#9a3412` (chữ trắng 7,3 : 1) thay cho `#c2410c` của bản thiết kế. Chữ đỏ nhỏ dùng `#991b1b`, nhãn "Đã duyệt" / "Từ chối" dùng chữ đậm hơn bản thiết kế để giữ mức 7 : 1 |
| Thủ kho | Việc hôm nay | Theo thiết kế "Thu Kho v2" (Claude Design), xem mục riêng bên dưới |
| Quản lý | Tổng quan | Theo thiết kế "Quan Ly Admin" (Claude Design, 4 file: khung + Kiểm soát, Kho & định mức, Hệ thống). Thành phần chung ở `layouts/AdminBits.tsx`. Thanh bên tối thu gọn được (lưu theo máy), ô sáng trượt theo mục đang chọn, số việc ở Phiếu điều tra / Cảnh báo. Thanh trên: đường dẫn, ca, đồng hồ, bảng lệnh Ctrl K (tìm màn, phiếu, thao tác, không phân biệt dấu), chuông. Phiếu điều tra mở chi tiết trong ngăn trượt phải (đường dẫn `/quan-ly/dieu-tra/:id`), phân bổ nguyên nhân rồi kết luận. Mã phiếu dùng JetBrains Mono. Chữ nhỏ nhất 14px (thiết kế dùng 13px cho nhãn) |

## Co giãn theo màn hình

Ở zoom trình duyệt 100%, mọi màn của mọi vai trò được co giãn theo bề rộng cửa sổ, lấy khung 1440px của bản thiết kế làm chuẩn (`lib/fitZoom.ts`): 1280px ra 0,89, 1366px ra 0,95, 1536px ra 1,07, 1920px ra 1,33 (giới hạn 0,85 đến 1,35; dưới 1024px để bố cục responsive tự lo). Người dùng tự zoom (Ctrl +) vẫn phóng to được vì mức zoom trang được tính riêng. Đánh đổi: ở cửa sổ hẹp (zoom dưới 1) chữ 14px hiển thị nhỏ hơn 14px một chút.

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

## Giao diện riêng của phục vụ bàn (sáng / tối)

Hai màn **Đặt món** và **Bàn & báo khách** dùng thiết kế "Phục Vụ" trên Claude Design. Giao diện này khác các vai trò còn lại:
- **Hai bản màu, mặc định sáng.** Quầy và sảnh thường sáng, thu ngân cần đọc số tiền nhanh, và các vai trò khác cũng dùng nền sáng.
  - **Sáng:** nền đá ấm `#F5F4F1`, thẻ trắng, chữ than `#1C1917`, màu nhấn paprika `#EB9360`, vàng `#FFD84D`, hồng `#F58BBD`; chữ màu dùng bản đậm (`#7C3410`, `#6B4300`, `#8A1240`).
  - **Tối** (bản thiết kế gốc): nền tím than `#140E1F`, cam san hô `#FF5A3C`, vàng `#FFD84D`, kem `#FFF6EC`, hồng `#FF4F9A`. Hợp với ca tối ở quán ánh sáng mờ.
  - Nút **Sáng / Tối / Tự động** trên đầu trang; Tự động = tối từ 18 giờ đến 6 giờ theo giờ hệ thống (có tính giờ demo). Lưu theo máy (`localStorage` khóa `serve-tone`).
- **Font:** Bricolage Grotesque cho tiêu đề, Be Vietnam Pro cho chữ thường.

| Phần | Cách làm |
|---|---|
| Bật / tắt | Lớp `night` gắn lên `<html>` khi đường dẫn là `/van-hanh/dat-mon` hoặc `/van-hanh/ban` (`layouts/NightBits.tsx`, `TabletLayout.tsx`). Bản sáng thêm lớp `day`. Rời khỏi hai màn này là về giao diện chung. Hộp thoại và thông báo cũng đổi màu theo. |
| Token | `html.night:not(.day)` trong `src/index.css` ghi đè bộ màu chung cho bản tối; `html.night.day` giữ bộ màu chung. Cả hai đặt cùng một bộ biến riêng: `--n-bg`, `--n-surface`, `--n-text`, `--n-muted`, `--n-line`, `--n-invert`, `--coral*`, `--lime*`, `--pink*`... Màn phục vụ chỉ dùng các biến này, không viết mã màu cứng. |
| Khung | Dải chữ chạy báo giờ demo; logo nghiêng; viên trạng thái ca; đồng hồ nhấp nháy dấu hai chấm; thẻ người dùng; tab dạng viên thuốc có nền trượt (≤ 3 tab). |
| Đặt món | Bàn vẽ có 4 ghế, "Mang đi" có hình túi, bàn đang có đơn có chấm nhấp nháy. Ô món có ảnh và giá; món hết có con dấu xoay, chạm vào thì rung và báo lý do. Ảnh món bay vào giỏ. Giỏ là tờ hóa đơn (kem ở bản tối, trắng ở bản sáng) với mã bàn lớn. **Mỗi bàn có giỏ nháp riêng.** Gửi bếp có pháo giấy. |
| Bàn & báo khách | Món hết nguyên liệu có ảnh, nút "Đổi món" / "Khách hủy". Mỗi bàn có thanh tiến độ (số món bếp đã xong) và chip trạng thái: Chờ bếp, Đang nấu, Bếp đã xong, Hết nguyên liệu, Đã hủy, Làm lại. |

**Khác với bản thiết kế:**
- **Nút "Mang ra" và trạng thái "Đã mang ra" không làm.** Hệ thống chưa lưu bước này; nếu chỉ giả lập trên một máy thì sẽ gây hiểu nhầm.
- **Món bếp làm xong** hiện "Bếp đã xong".
- **Huy hiệu trên tab "Bàn & báo khách"** đếm số món hết nguyên liệu cần báo khách.
- **Chưa chọn bàn thì không tự chọn B1:** giỏ ghi "Chưa chọn", tránh gửi nhầm bàn.

**Tương phản:**
- Chữ nhỏ đạt 7 : 1 ở cả hai bản.
- Chữ trên nền cam / hồng luôn là chữ lớn đậm, đạt mức AAA cho chữ lớn.
- Axe-core trên hai màn: 0 vi phạm.
- Hiệu ứng chuyển động tắt khi máy bật "giảm chuyển động".

## Giao diện riêng của thủ kho ("Thu Kho v2")

Sáu màn của thủ kho dùng thiết kế "Thu Kho v2" trên Claude Design: **Hôm nay**, **Nhập hàng**, **Bàn giao**, **Cân trả cuối ca**, **Kiểm kê**, **Hao hụt**. Code nằm ở `layouts/StoreBits.tsx` (khung), `components/ScaleWeigh.tsx` (màn cân) và `pages/store/`.

| Phần | Cách làm |
|---|---|
| Bật / tắt | `TabletLayout.tsx` dùng `StoreShell` khi đường dẫn nằm trong `STORE_ROUTES`. Màn **Hao hụt** chỉ dùng giao diện này khi người dùng là thủ kho và không làm bếp; bếp, bếp trưởng và quản lý vẫn dùng màn hao hụt của bếp. |
| Khung | Thanh bên 268px, nền viên than trượt theo mục đang chọn, số việc chờ trên từng mục (cân trả quá giờ có nền đỏ). Thẻ đồng hồ có giây, ca hiện tại, trạng thái ca, thanh tiến độ của ca. Màn hẹp chuyển sang dải tab ngang. Quản lý có thêm link "Màn quản lý". |
| Hôm nay | Lời chào theo buổi, thẻ than "Nên làm tiếp" có vòng "x/4 việc xong", dải "Nhịp ngày" 06:00 đến 22:00 có mốc "Bây giờ", 4 bước trong ngày, "Hoạt động gần đây" gộp phiếu nhập, bàn giao đã ký, kiểm kê đã chốt, hao hụt tại Kho. |
| Màn cân (dùng chung) | Mỗi nguyên liệu một dòng, dòng đang nhập nổi viền than; bên phải có ô số "SỐ ĐANG NHẬP" nền than và bàn phím số dính. Gõ được bằng bàn phím: số, dấu phẩy, Backspace, Enter hoặc mũi tên để đổi dòng. |
| Bàn giao | Ba bước: thủ kho cân xuất, thẻ than "Đưa máy cho bếp trưởng", bếp trưởng cân lại (không thấy số thủ kho) và ký PIN. Lệch quá dung sai thì hiện danh sách dòng lệch. |
| Cân trả, kiểm kê | Cân / đếm mù, hỏi xác nhận trước khi chốt, sau khi chốt hiện thẻ hoàn tất. |
| Hao hụt | Chip lý do: Hết hạn, Hỏng do bảo quản, Đổ vỡ / rơi, Côn trùng / chuột (ghi vào loại "Khác" kèm lý do). Ghi nhiều nguyên liệu một lần, mỗi dòng là một phiếu. Bên dưới là các phiếu gần đây kèm trạng thái duyệt. |

**Khác với bản thiết kế:**
- **Không có nút "Đọc cân".** Máy chưa nối với cân điện tử; nếu nút này sinh số giả thì số liệu sẽ sai.
- **Giữ form tạo phiếu nhập mới** và nút **hủy phiếu bàn giao** để cân xuất lại. Bản thiết kế không có hai chức năng này.
- **Hao hụt trừ tồn Kho ngay.** Màn ghi rõ là bếp trưởng duyệt sau, phiếu vượt hạn mức thì quản lý duyệt.
- Chữ xám nhỏ dùng `#4f4a45` (đạt 7 : 1) thay cho `#6b645f` của bản thiết kế.

**Kiểm định:**
- Axe-core trên 6 màn: 0 vi phạm.
- Đã chạy trọn luồng trên bản sao DB, không có lỗi trang: nhập hàng, bàn giao, bếp trưởng ký PIN, cân trả đóng ca, kiểm kê nhóm A, ghi hao hụt.

## Landing page (`/gioi-thieu`)

Trang giới thiệu hệ thống, làm theo skill **design-taste-frontend** của Taste Skill. Trang không cần đăng nhập. Code nằm trong `src/pages/landing/`, thư viện chuyển động là `motion` (bản 13.4.4). Trang được tải riêng (lazy), nên app vận hành không nặng thêm.

**Cách đọc đề bài:** landing sản phẩm cho chủ quán và hội đồng chấm đồ án. Giữ thương hiệu của app: paprika trên nền đá ấm, Bricolage Grotesque cho tiêu đề, Plus Jakarta Sans cho chữ thường. Ba thông số: DESIGN_VARIANCE 8, MOTION_INTENSITY 7, VISUAL_DENSITY 4.

| Khối | Cách làm |
|---|---|
| Mở đầu | Chữ trái, ảnh phải. Tiêu đề 2 dòng trượt lên khi tải trang. Ảnh bếp thật nằm dưới ảnh chụp báo cáo AvT; khi cuộn, ảnh báo cáo trôi nhanh hơn ảnh bếp. |
| Xây bằng | Dải logo công nghệ chạy ngang (lấy từ Simple Icons), tô theo màu chữ. Đây là dải chạy ngang duy nhất của trang. |
| Hành trình của 1 kg thịt bò | Đúng kịch bản AC-11. Trên màn rộng, phần này ghim lại, cuộn dọc kéo 5 bước trượt ngang. Hai số "Sổ nói" và "Cân nói" đổi theo từng bước. Màn hẹp hoặc máy bật giảm chuyển động thì các bước xếp dọc. |
| Câu nguyên tắc | Chữ lớn sáng dần theo nhịp cuộn. Chữ chưa sáng vẫn đạt 4,8 : 1. |
| Tính năng | Lưới 5 ô cho 5 tính năng: đếm mù (ảnh cân), sổ chỉ ghi thêm, bàn phím PIN bấm thử được, ngưỡng hai tầng (số mặc định của nhóm A), phiếu điều tra (ảnh màn thật). |
| Vai trò | Dải ảnh chụp màn hình thật của 4 nhóm vai trò. Bấm vào dải nào thì dải đó mở rộng, phần mô tả hiện bên dưới. Màn hẹp hiện thành thẻ. |
| Chạy thử | Hai lệnh Docker trong README và 4 con số có thật của dự án. |
| Khối cuối | Ảnh chảo lửa, nút "Vào hệ thống" và "Xem mã nguồn". |

**Theo quy tắc của Taste Skill:**
- Không có dấu gạch dài.
- Không có nhãn nhỏ viết hoa trên đầu mục.
- Không dựng giao diện giả bằng div: mọi ảnh sản phẩm đều chụp từ chính hệ thống. Riêng ảnh màn bếp dùng phiếu món mẫu, vì DB demo lúc chụp không có món nào đang chờ.

**Chế độ màu và co giãn:**
- Luôn nền sáng, kể cả khi máy đặt chế độ tối (đã bỏ bản nền tối theo yêu cầu).
- Trang không bị co giãn theo khung 1440px (`useFitZoom` bỏ qua khi `<html>` có lớp `landing`), vì phần ghim tính theo `100dvh`.

**Kiểm định:**
- Axe-core trên 4 trường hợp (máy đặt nền sáng, máy đặt nền tối, màn 390px, giảm chuyển động): 0 vi phạm.
- Ảnh 3 màn quản lý (tổng quan, báo cáo AvT, phiếu điều tra) chụp lại theo giao diện admin mới. Muốn chụp lại lần nữa: đăng nhập `quanly`, khung 1440 × 900, tỉ lệ điểm ảnh 1,5, ẩn dải giờ demo, rồi lưu WebP 1600px vào `public/img/landing/man-quanly-*.webp`.
- Màn 390px không có cuộn ngang.

### Di chuyển giữa trang giới thiệu và màn đăng nhập

| Tình huống | Cách làm |
|---|---|
| Bấm "Vào hệ thống" | Trang giới thiệu lùi lại và mờ đi, màn đăng nhập trượt vào. Logo bay từ thanh điều hướng sang góc ảnh. Bấm từ khối cuối thì ảnh chảo lửa nở thành nửa trái màn đăng nhập (hai nơi dùng cùng một ảnh). |
| Rê chuột hoặc focus vào nút | Tải sẵn danh sách nhân viên, nên màn đăng nhập hiện tên ngay, không qua khung chờ. |
| "Vào hệ thống với vai trò…" (mục Vai trò) | Mở `/dang-nhap?nhom=server|kitchen|storekeeper|manager`. Nhóm đó lên đầu, có nền paprika nhạt và nhãn "Vai trò bạn chọn". |
| Đã đăng nhập | Các nút đổi thành "Tiếp tục làm việc" và vào thẳng màn làm việc. Link theo vai trò bị ẩn. |
| "Trang giới thiệu" (góc ảnh màn đăng nhập) | Vừa đi từ trang giới thiệu sang thì lùi lịch sử, trang mở lại đúng chỗ đang đọc. Mở thẳng màn đăng nhập (máy tính bảng) thì trang giới thiệu mở từ đầu. Hiệu ứng trượt theo chiều ngược lại. |
| Nút Back của trình duyệt | Về đúng chỗ đang đọc. Vị trí cuộn lưu trong `sessionStorage`. |
| Bấm Ctrl hoặc chuột giữa | Mở tab mới như link thường (mọi đường chuyển trang đều là thẻ `<a>` thật). |
| Máy bật giảm chuyển động, hoặc trình duyệt chưa hỗ trợ View Transitions | Chuyển trang ngay, không có hiệu ứng. |

**Code:** `src/lib/pageTransition.ts`, CSS `::view-transition-*` ở cuối `index.css`.

- BrowserRouter đổi route trong `startTransition`, nên không flush đồng bộ được. Vì vậy hàm chuyển trang chờ trang đích gắn `data-page` vào DOM rồi mới chụp trạng thái mới.
- Trong lúc chờ, trình duyệt tạm dừng vẽ, nên không dùng `requestAnimationFrame`.
- Zoom của app được tính lại ngay bằng `refitZoom()` để không bị giật sau hiệu ứng.

`/` vẫn mở thẳng màn đăng nhập cho máy tính bảng của nhân viên. Trang giới thiệu dành cho người xem lần đầu.
