# Quản lý vận hành bếp

Hệ thống giúp nhà hàng **biết chính xác nguyên liệu đi đâu**. Hệ thống so lượng nguyên liệu *đáng lẽ phải dùng* theo số món đã bán với lượng *thực tế đã dùng* (phương pháp AvT, actual vs. theoretical). Khi hai con số lệch nhau, hệ thống chỉ ra lệch bao nhiêu gram, bao nhiêu tiền, trong ca nào, ai chịu trách nhiệm, và buộc quản lý giải trình.

Đồ án xây theo bản mô tả "Hệ thống quản lý vận hành bếp v1.5".

![Màn đăng nhập](docs/anh/dang-nhap.webp)

## Hệ thống giải quyết vấn đề gì?

Ví dụ: bếp nhận **1 kg thịt bò**. Mỗi bát bò xào dùng 20 g, nên 1 kg làm được khoảng **50 bát**.

- Bán 49 hay 51 bát là sai số cân bình thường, hệ thống bỏ qua.
- Mới bán **5 bát** mà bếp báo "hết bò" là có vấn đề. Theo lý thuyết chỉ dùng 100 g, còn 900 g (khoảng 225.000 đ) không rõ đi đâu.

Không thể hỏi bếp "còn bao nhiêu" rồi tin con số đó. Vì vậy hệ thống lấy **số liệu thực tế độc lập với lời khai của bếp**:

| Cơ chế | Cách làm |
|---|---|
| Bàn giao có ký nhận | Thủ kho cân xuất, bếp trưởng **tự cân lại** (không thấy số của thủ kho) rồi ký bằng mã PIN. Lệch quá 5 g thì không ký được. |
| Trừ kho tự động | Món chuyển sang "đang nấu" là hệ thống trừ nguyên liệu theo công thức. |
| Cân trả và kiểm kê "mù" | Người cân, người đếm không được thấy tồn trên sổ, nên không thể "đếm cho khớp". |
| Ngưỡng hai tầng | Lệch nhỏ chỉ ghi nhận. Lệch lớn tự mở **phiếu điều tra** gắn với ca và bếp trưởng đã ký. |
| Giải trình | Hệ thống gợi ý nguyên nhân kèm bằng chứng (nhập sai, hao hụt chưa ghi, công thức sai, thất thoát…). Quản lý kết luận, sổ kho được tất toán đúng loại. |
| Không sửa được dấu vết | Sổ giao dịch kho và nhật ký thao tác **chỉ được ghi thêm**, cơ sở dữ liệu chặn mọi lệnh sửa và xóa. |

## Ai dùng, dùng để làm gì?

| Vai trò | Thiết bị | Việc chính |
|---|---|---|
| **Phục vụ** | Máy tính bảng | Chọn bàn, chọn món gửi bếp; nhận báo khi món hết nguyên liệu để đổi món hoặc hủy |
| **Bếp / bếp trưởng** | Máy tính bảng | Xem phiếu món theo thứ tự, bấm "Bắt đầu nấu" / "Xong"; ký nhận bàn giao; ghi và duyệt hao hụt; báo hết nguyên liệu |
| **Thủ kho** | Máy tính bảng | Màn "Việc hôm nay": nhập hàng, bàn giao đầu ca, cân trả cuối ca, kiểm kê |
| **Quản lý** | Máy tính | Tổng quan, phiếu điều tra, cảnh báo, báo cáo AvT (xuất Excel), món & công thức, ngưỡng, nhật ký |

| Phục vụ: đặt món | Bếp: phiếu món đang nấu |
|---|---|
| ![Đặt món](docs/anh/phuc-vu-dat-mon.webp) | ![Phiếu bếp](docs/anh/bep-phieu-mon.webp) |

| Thủ kho: việc hôm nay | Quản lý: tổng quan |
|---|---|
| ![Việc hôm nay](docs/anh/thu-kho-hom-nay.webp) | ![Tổng quan](docs/anh/quan-ly-tong-quan.webp) |

## Cách chạy (khuyên dùng Docker)

### 1. Cài trước

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) hoặc Docker Engine + Docker Compose (Linux). Mở Docker Desktop và đợi nó chạy xong.
- [Git](https://git-scm.com/).

Không cần cài Python, Node.js hay PostgreSQL: Docker lo hết.

### 2. Tải code và khởi động

```bash
git clone https://github.com/congngoc308/project.git
cd project
docker compose up -d --build
```

Lần đầu mất vài phút để tải và build. Lệnh này chạy 4 dịch vụ:

| Dịch vụ | Địa chỉ | Ghi chú |
|---|---|---|
| `web` | http://localhost:5190 | Giao diện |
| `api` | http://localhost:8010/docs | API (FastAPI), tự tạo bảng khi khởi động |
| `db` | `localhost:5450` | PostgreSQL chính (user / mật khẩu: `qlb` / `qlb`) |
| `db-test` | `localhost:5451` | PostgreSQL riêng cho kiểm thử |

### 3. Nạp dữ liệu mẫu

```bash
docker compose exec api python -m seed.demo
```

Lệnh này **xóa sạch dữ liệu cũ** và sinh 30 ngày lịch sử: món, công thức, đơn hàng, bàn giao, kiểm kê, một số vụ thất thoát được dàn dựng sẵn để thấy hệ thống phát hiện. Lệnh chạy mất khoảng 3 phút. Cuối cùng nó đặt **đồng hồ demo** về 06:20 hôm nay (ca sáng, chưa nhận bàn giao).

### 4. Mở và đăng nhập

Vào http://localhost:5190, chạm vào tên rồi nhập mã PIN:

| Vai trò | Người | Đăng nhập |
|---|---|---|
| Quản lý | Lê Minh Quân | `quanly` / `quanly123` hoặc PIN `9999` |
| Thủ kho | Phạm Thị Thu, Đỗ Văn Khải | PIN `1111`, `1112` |
| Bếp trưởng | Nguyễn Văn Bình, Trần Đức Hùng | PIN `2221`, `2222` |
| Nhân viên bếp | Hoàng Văn Nam, Vũ Thị Lan, Bùi Quốc Tuấn | PIN `3331`, `3332`, `3333` |
| Phục vụ | Đặng Thu Trang, Ngô Minh Khoa | PIN `4441`, `4442` |
| Kiêm nhiệm (thủ kho + bếp) | Lý Văn Sơn | PIN `5551` |

Muốn đổi người thì bấm **Đổi người** ở góc trên. Nên mở hai cửa sổ trình duyệt: một cửa sổ nhỏ (khoảng 1024×768) đóng vai máy tính bảng cho phục vụ, bếp, thủ kho; một cửa sổ lớn cho quản lý.

### 5. Thử kịch bản "1 kg bò, mới 5 bát đã hết"

Làm theo từng bước trong [docs/DEMO.md](docs/DEMO.md):

1. Thủ kho nhập 1 kg bò.
2. Thủ kho bàn giao bò cho bếp, bếp trưởng cân lại và ký PIN.
3. Phục vụ gọi 5 bát bò xào, bếp nấu.
4. Thủ kho cân trả cuối ca được 0 g.
5. Quản lý thấy phiếu điều tra: thiếu **900 g ≈ 225.000 đ**, gắn với bếp trưởng ca đó.

Màn **Đồng hồ demo** (menu quản lý) dùng để tua giờ: tới cuối ca, +48 giờ để phiếu quá hạn…

### Dừng, chạy lại, xóa

```bash
docker compose stop          # dừng, giữ dữ liệu
docker compose start         # chạy lại
docker compose down -v       # xóa hẳn container và dữ liệu
```

Nếu cổng 5190, 8010 hoặc 5450 đã bị chương trình khác dùng, sửa phần `ports` trong `docker-compose.yml`.

## Chạy khi phát triển (không dùng Docker cho api và web)

Cần Python 3.11+ và Node.js 22 (Vite 8 yêu cầu Node 20.19+ hoặc 22.12+). Cơ sở dữ liệu vẫn chạy bằng Docker:

```bash
docker compose up -d db db-test

# Backend
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Linux / macOS: .venv/bin/pip
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m seed.demo
.venv/Scripts/uvicorn app.main:app --port 8010 --reload

# Frontend (cửa sổ dòng lệnh khác)
cd frontend
npm install
npm run dev                                           # http://localhost:5190, /api chuyển sang :8010
```

## Kiểm thử

```bash
cd backend && .venv/Scripts/python -m pytest          # cần db-test (cổng 5451)
cd frontend && npx tsc -b && npm run build
```

Mỗi tiêu chí nghiệm thu (AC) trong bản mô tả có test tương ứng:

| Tiêu chí | File test |
|---|---|
| AC-01 → AC-05: đơn món, trừ kho theo công thức, hủy, hao hụt sơ chế | `backend/tests/test_ac_theoretical.py` |
| AC-06 → AC-11: nhập hàng, bàn giao, cân trả mù, ngưỡng, kịch bản 1 kg bò | `backend/tests/test_ac_actual.py` |
| AC-12 → AC-18: báo hết, tất toán, xu hướng, báo cáo AvT, phân quyền, nhật ký | `backend/tests/test_ac_control.py` |
| Sổ kho chỉ ghi thêm, ghi đồng thời không sai tồn | `backend/tests/test_ledger.py` |

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Giao diện | React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query / Table, icon Phosphor |
| Máy chủ | Python, FastAPI, SQLAlchemy 2, Alembic, pytest |
| Cơ sở dữ liệu | PostgreSQL 16 |
| Cập nhật tức thời | Server-Sent Events: món mới hiện ngay ở bếp, báo hết hiện ngay ở phục vụ |

## Cấu trúc thư mục

```
backend/
  app/
    services/ledger.py         sổ giao dịch kho, nơi duy nhất ghi biến động tồn
    services/variance.py       tính chênh lệch, ngưỡng hai tầng, cảnh báo xu hướng
    services/investigations.py gợi ý nguyên nhân, kết luận và tất toán phiếu điều tra
    services/...               đơn món, bàn giao, kiểm kê, nhập hàng, hao hụt, báo cáo
    api/                       các API
    clock.py                   đồng hồ nghiệp vụ (tua được ở chế độ demo)
  alembic/                     tạo bảng + chặn sửa / xóa sổ kho
  seed/                        dữ liệu mẫu 30 ngày
  tests/                       kiểm thử theo tiêu chí nghiệm thu
frontend/
  src/layouts/                 bố cục máy tính bảng và bố cục quản lý
  src/pages/ops/               màn phục vụ, bếp, thủ kho
  src/pages/manager/           màn quản lý
  public/img/                  ảnh món và ảnh bếp
docs/
  DEMO.md                      kịch bản trình bày từng bước
  SO_DO_HE_THONG.md            sơ đồ phân tích thiết kế (use case, DFD, ERD, luồng, trạng thái)
  GIAO_DIEN.md                 thiết kế giao diện, bảng màu, nguồn và giấy phép ảnh
```

## Giả định đang dùng

- 2 ca mỗi ngày: ca sáng 06:00-14:00, ca chiều 14:00-22:00.
- **Ngưỡng** (sửa được ở màn Cài đặt):
  - nhóm A (hàng tươi): lệch > 2,5% và > 25 g thì cảnh báo; > 5% và > 50 g thì bắt buộc giải trình;
  - nhóm C (gia vị, hàng khô): 10% và 20%.
- **Mốc khác:** hạn xử lý phiếu điều tra 48 giờ, dung sai cân khi bàn giao 5 g, cảnh báo xu hướng sau 3 kỳ lệch cùng chiều.
- Chênh lệch quy ra tiền theo đơn giá nhập gần nhất.
- Các mục "Nên có" và "Để sau" của bản mô tả chưa làm.

## Lưu ý khi triển khai thật

Mật khẩu cơ sở dữ liệu, `SECRET_KEY` trong `docker-compose.yml` và các mã PIN ở trên chỉ dùng cho demo. Hãy đổi chúng và tắt `DEMO_MODE` (chế độ có đồng hồ tua được) trước khi dùng thật.

## Nguồn ảnh

Ảnh món ăn và ảnh bếp lấy từ Wikimedia Commons, theo giấy phép CC0, CC BY và CC BY-SA. Tác giả và link gốc từng ảnh ghi trong [docs/GIAO_DIEN.md](docs/GIAO_DIEN.md#ảnh-thật).
