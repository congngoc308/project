# Sơ đồ phân tích thiết kế — Hệ thống quản lý vận hành bếp

Vẽ theo đúng code trong repo. Mở bằng GitHub hoặc VS Code (Markdown Preview Mermaid) để xem sơ đồ.

## Phân tích

### 01. Vòng kiểm soát Định mức – Thực tế – Giải trình

Đây là xương sống của đề tài. Bên trái tạo ra số lý thuyết (đáng lẽ phải dùng), nhánh giữa tạo ra số thực tế do người không dùng nguyên liệu cân đếm, rồi hệ thống so hai số với ngưỡng. Lệch lớn thì buộc quản lý giải trình.

```mermaid
flowchart LR
  subgraph LT["Số lý thuyết"]
    A["1 · Định mức chuẩn<br/>món, công thức có phiên bản,<br/>quy đổi đơn vị, hao hụt sơ chế"] --> B["2 · Bán hàng<br/>đơn → bếp bấm Bắt đầu<br/>→ trừ kho tự động"]
  end
  subgraph TT["Số thực tế độc lập với bếp"]
    C["3 · Nhập hàng, bàn giao có cân + ký,<br/>cân trả mù cuối ca,<br/>phiếu hao hụt, kiểm kê mù / đột xuất"]
  end
  B --> D{"4 · So sánh<br/>chênh lệch = tồn sổ − tồn kiểm kê<br/>(gram, %, tiền)"}
  C --> D
  D -->|"trong ngưỡng"| E["Tự điều chỉnh, ghi nhận xu hướng"]
  D -->|"mức cảnh báo"| F["Tự điều chỉnh + hiện dashboard"]
  D -->|"bắt buộc duyệt"| G["5 · Phiếu điều tra<br/>gợi ý nguyên nhân + bằng chứng<br/>quản lý kết luận, tất toán"]
  H["6 · Bếp báo hết nguyên liệu"] -->|"kiểm kê nhanh = 0"| D
  H --> I["Khóa món, báo phục vụ theo bàn"]
  E --> R["Báo cáo AvT · Dashboard · Cảnh báo xu hướng"]
  F --> R
  G --> R
      
```

*Cài đặt: services/orders.py (lý thuyết) · services/handover.py, counts.py, receiving.py, waste.py (thực tế) · services/variance.py (so sánh) · services/investigations.py (giải trình)*

### 02. Use case theo vai trò

Năm vai trò, mỗi người có thể kiêm nhiều vai trò. Đường nét đứt là việc cần người khác xác nhận: đó là chỗ thể hiện phân tách nhiệm vụ.

```mermaid
flowchart LR
  PV(["👤 Phục vụ"])
  NB(["👤 Nhân viên bếp"])
  BT(["👤 Bếp trưởng ca"])
  TK(["👤 Thủ kho"])
  QL(["👤 Quản lý"])
  subgraph HT["Hệ thống quản lý bếp"]
    U1("Tạo đơn, sửa/hủy món chưa nấu")
    U2("Báo hết món")
    U3("Bắt đầu / Hoàn tất món")
    U4("Hủy / làm lại món đã nấu")
    U5("Báo hết nguyên liệu")
    U6("Ghi hao hụt")
    U7("Ký nhận bàn giao bằng PIN")
    U8("Duyệt hao hụt trong hạn mức")
    U9("Nhập hàng")
    U10("Bàn giao đầu ca / bổ sung")
    U11("Cân trả cuối ca (mù)")
    U12("Kiểm kê cuối ngày (mù)")
    U13("Kiểm kê đột xuất")
    U14("Kết luận phiếu điều tra")
    U15("Món, công thức, ngưỡng, người dùng")
    U16("Dashboard, báo cáo AvT, nhật ký")
  end
  PV --- U1
  PV --- U2
  NB --- U3
  NB --- U4
  NB --- U5
  NB --- U6
  BT --- U7
  BT --- U8
  BT -.->|"xác nhận PIN"| U4
  TK --- U9
  TK --- U10
  TK --- U11
  TK --- U12
  U10 -.->|"cần ký"| U7
  QL --- U13
  QL --- U14
  QL --- U15
  QL --- U16
      
```

### 03. Sơ đồ phân rã chức năng (BFD)

Bảy nhóm chức năng của MVP. Nhóm 4 là trọng tâm của đề tài; các nhóm còn lại tồn tại để cung cấp dữ liệu đúng cho nó.

```mermaid
flowchart LR
  R["Hệ thống quản lý<br/>vận hành bếp"]
  R --> F1["1. Quản lý định mức"]
  R --> F2["2. Bán hàng và bếp"]
  R --> F3["3. Quản lý kho"]
  R --> F4["4. Kiểm soát và giải trình"]
  R --> F5["5. Phản ứng khi hết hàng"]
  R --> F6["6. Báo cáo"]
  R --> F7["7. Hệ thống"]
  F1 --> F11["1.1 Món"] & F12["1.2 Công thức có phiên bản"] & F13["1.3 Nguyên liệu, nhóm A/C, quy đổi"] & F14["1.4 Ngưỡng, hạn mức hao hụt"]
  F2 --> F21["2.1 Tạo / xác nhận đơn"] & F22["2.2 Danh sách món của bếp"] & F23["2.3 Bắt đầu → trừ kho"] & F24["2.4 Hủy, làm lại"]
  F3 --> F31["3.1 Phiếu nhập"] & F32["3.2 Bàn giao ca có ký"] & F33["3.3 Cân trả cuối ca"] & F34["3.4 Phiếu hao hụt"] & F35["3.5 Kiểm kê định kỳ / đột xuất"]
  F4 --> F41["4.1 Tính chênh lệch, ngưỡng hai tầng"] & F42["4.2 Cảnh báo, xu hướng"] & F43["4.3 Phiếu điều tra"] & F44["4.4 Tất toán theo nguyên nhân"]
  F5 --> F51["5.1 Báo hết nguyên liệu"] & F52["5.2 Báo hết món"] & F53["5.3 Khóa / bán lại món"]
  F6 --> F61["6.1 Dashboard"] & F62["6.2 AvT + Excel"] & F63["6.3 Hao hụt, theo ca, kiểm kê, nhập hàng"]
  F7 --> F71["7.1 Người dùng, PIN"] & F72["7.2 Nhật ký thao tác"] & F73["7.3 Đồng hồ demo"]
      
```

### 04. DFD mức ngữ cảnh

Hệ thống là một khối duy nhất; các mũi tên là dữ liệu đi vào và đi ra với từng tác nhân.

```mermaid
flowchart LR
  PV["Phục vụ"] -->|"đơn món, đổi / hủy món"| S(("0<br/>Hệ thống<br/>quản lý bếp"))
  S -->|"thực đơn còn bán, thông báo hết theo bàn"| PV
  B["Bếp và bếp trưởng"] -->|"bắt đầu / hoàn tất, báo hết, hao hụt, ký PIN"| S
  S -->|"danh sách món theo thứ tự, phiếu chờ ký"| B
  TK["Thủ kho"] -->|"phiếu nhập, số cân xuất, số cân trả, số kiểm kê"| S
  S -->|"form cân mù, gợi ý bàn giao bổ sung"| TK
  NCC["Nhà cung cấp"] -->|"hóa đơn, hàng giao"| TK
  QL["Quản lý"] -->|"công thức, ngưỡng, kết luận điều tra, kiểm kê đột xuất"| S
  S -->|"dashboard, AvT, cảnh báo, phiếu điều tra, nhật ký"| QL
      
```

### 05. DFD mức 0

Khối hệ thống được tách thành sáu tiến trình. Kho dữ liệu trung tâm là D3 Sổ giao dịch kho: mọi biến động tồn đều ghi vào đây, chỉ ghi thêm, không sửa.

```mermaid
flowchart LR
  QL["Quản lý"]
  PV["Phục vụ"]
  BEP["Bếp"]
  TK["Thủ kho"]
  P1(("1.0<br/>Quản lý<br/>định mức"))
  P2(("2.0<br/>Xử lý đơn<br/>và chế biến"))
  P3(("3.0<br/>Nhập, bàn giao,<br/>hao hụt"))
  P4(("4.0<br/>Kiểm kê và<br/>tính chênh lệch"))
  P5(("5.0<br/>Điều tra và<br/>tất toán"))
  P6(("6.0<br/>Cảnh báo và<br/>báo cáo"))
  D1[("D1 Món, công thức")]
  D2[("D2 Đơn hàng")]
  D3[("D3 Sổ giao dịch kho")]
  D4[("D4 Phiên kiểm kê")]
  D5[("D5 Phiếu điều tra")]
  D6[("D6 Cảnh báo, nhật ký")]
  QL -->|"công thức, ngưỡng"| P1 --> D1
  PV -->|"đơn"| P2
  BEP -->|"bắt đầu, hủy, làm lại"| P2
  D1 -->|"phiên bản hiệu lực"| P2
  P2 --> D2
  P2 -->|"tiêu hao lý thuyết"| D3
  TK -->|"phiếu nhập, cân xuất"| P3
  BEP -->|"ký PIN, hao hụt"| P3
  P3 -->|"nhập, bàn giao, hao hụt"| D3
  TK -->|"số cân trả, số đếm mù"| P4
  BEP -->|"báo hết = đếm 0"| P4
  D3 -->|"tồn sổ, lý thuyết kỳ"| P4
  P4 --> D4
  P4 -->|"điều chỉnh / chờ giải trình"| D3
  P4 -->|"lệch bắt buộc duyệt"| P5
  QL -->|"kết luận, phân bổ"| P5
  P5 --> D5
  P5 -->|"giao dịch tất toán"| D3
  D3 --> P6
  D4 --> P6
  D5 --> P6
  P6 --> D6
  P6 -->|"dashboard, AvT, cảnh báo"| QL
      
```

## Thiết kế

### 06. Kiến trúc hệ thống

Một web app React có hai bố cục: máy tính bảng (nút lớn) cho phục vụ, bếp, kho và quản lý (có sidebar). Backend FastAPI chia theo service; mỗi thao tác chạy trong một transaction Postgres. Sự kiện (đơn mới, hết hàng, cảnh báo) được đẩy về trình duyệt bằng SSE sau khi commit.

```mermaid
flowchart TB
  subgraph Client["Trình duyệt · React + Vite + shadcn/ui · cổng 5190"]
    T["Bố cục máy tính bảng<br/>đặt món · bếp · bàn giao · cân trả · nhập hàng · kiểm kê · hao hụt"]
    M["Bố cục quản lý<br/>dashboard · AvT · điều tra · công thức · báo cáo · nhật ký"]
  end
  subgraph API["FastAPI · cổng 8010"]
    R["Routers /api/*<br/>kiểm tra vai trò ở server"]
    SSE["/api/events (SSE)<br/>bus sự kiện trong tiến trình"]
    subgraph SV["Services"]
      L["ledger<br/>nơi duy nhất ghi tồn,<br/>khóa dòng FOR UPDATE"]
      V["variance<br/>chênh lệch + ngưỡng"]
      I["investigations<br/>gợi ý, kết luận, tất toán"]
      O["orders · handover · counts<br/>receiving · waste · outofstock"]
      J["monitor (mỗi phút)<br/>quá giờ, chưa ký, quá hạn"]
    end
    CK["clock.now()<br/>đồng hồ nghiệp vụ / demo"]
  end
  DB[("PostgreSQL 16 · cổng 5450<br/>stock_txns, audit_log: trigger chặn sửa/xóa")]
  T -->|"HTTP + cookie phiên"| R
  M -->|"HTTP + cookie phiên"| R
  SSE -.->|"order, item, out_of_stock, alert"| T
  SSE -.-> M
  R --> O
  R --> I
  O --> L
  O --> V
  V --> I
  V --> L
  I --> L
  J --> DB
  L --> DB
  O --> DB
  CK -.-> O
      
```

*Cài đặt: backend/app/main.py · app/events.py · app/clock.py · frontend/src/layouts/*

### 07. ERD — danh mục, ca và bán hàng

Mỗi món có nhiều phiên bản công thức theo ngày hiệu lực. Khi món chuyển Đang chế biến, order_items lưu lại recipe_version_id đang hiệu lực, nên sửa công thức sau đó không làm đổi số liệu cũ.

```mermaid
erDiagram
  MENU_ITEMS ||--o{ RECIPE_VERSIONS : "có phiên bản"
  RECIPE_VERSIONS ||--|{ RECIPE_LINES : "gồm"
  INGREDIENTS ||--o{ RECIPE_LINES : "dùng trong"
  INGREDIENTS ||--o{ UNIT_CONVERSIONS : "quy đổi"
  MENU_ITEMS ||--o{ MENU_LOCKS : "bị khóa bán"
  INGREDIENTS |o--o{ MENU_LOCKS : "do hết"
  SHIFT_TEMPLATES ||--o{ SHIFTS : "sinh ca"
  USERS |o--o{ SHIFTS : "bếp trưởng ký nhận"
  ORDERS ||--|{ ORDER_ITEMS : "gồm"
  MENU_ITEMS ||--o{ ORDER_ITEMS : "là món"
  RECIPE_VERSIONS |o--o{ ORDER_ITEMS : "trừ kho theo"
  SHIFTS |o--o{ ORDER_ITEMS : "chế biến trong ca"
  MENU_ITEMS {
    int id PK
    string code
    string name
    decimal price
    string status "selling / stopped"
  }
  RECIPE_VERSIONS {
    int id PK
    int menu_item_id FK
    int version_no
    datetime effective_from
    string reason
  }
  RECIPE_LINES {
    int id PK
    int recipe_version_id FK
    int ingredient_id FK
    decimal qty
    decimal prep_loss_pct
    decimal issue_qty_base "xuất kho / phần"
  }
  INGREDIENTS {
    int id PK
    string name
    string control_group "A / C"
    string base_unit "g / ml / cai"
    decimal last_unit_cost
    decimal waste_limit
  }
  SHIFTS {
    int id PK
    date business_date
    datetime planned_start
    datetime planned_end
    string status "planned / open / closed"
    int head_chef_id FK
    bool sod_violation
  }
  ORDER_ITEMS {
    int id PK
    int order_id FK
    int menu_item_id FK
    int qty
    string status
    int seq "thứ tự bếp"
    int recipe_version_id FK
    int shift_id FK
  }
      
```

### 08. ERD — kho, kiểm kê và giải trình

Mọi chứng từ (phiếu nhập, bàn giao, hao hụt, dòng kiểm kê, phiếu điều tra) đều sinh ra các dòng STOCK_TXNS bất biến, trỏ ngược về chứng từ qua source_type/source_id. STOCK_BALANCES chỉ là bản cache của SUM, khóa dòng khi ghi để chống ghi đồng thời.

```mermaid
erDiagram
  RECEIPTS ||--|{ RECEIPT_LINES : "gồm"
  HANDOVERS ||--|{ HANDOVER_LINES : "gồm"
  SHIFTS ||--o{ HANDOVERS : "bàn giao cho"
  COUNT_SESSIONS ||--|{ COUNT_LINES : "gồm"
  COUNT_LINES ||--o| INVESTIGATIONS : "lệch lớn mở"
  STOCK_TXNS |o--o{ STOCK_TXNS : "ref_txn_id: đảo / điều chỉnh"
  INGREDIENTS ||--o{ STOCK_TXNS : "biến động"
  INGREDIENTS ||--o{ STOCK_BALANCES : "tồn theo vị trí"
  RECEIPT_LINES |o--o| STOCK_TXNS : "ghi sổ"
  WASTE_SLIPS |o--o| STOCK_TXNS : "ghi sổ"
  COUNT_LINES |o--o| STOCK_TXNS : "điều chỉnh / chờ giải trình"
  STOCK_TXNS {
    int id PK
    datetime occurred_at
    string txn_type
    int ingredient_id FK
    string location "kho / bep"
    decimal qty "+ vào, - ra"
    decimal value
    int shift_id FK
    string source_type
    int source_id
    int ref_txn_id FK
    bool late "ghi muộn"
    string cause
    int responsible_user_id FK
    int created_by FK
    int approved_by FK
  }
  STOCK_BALANCES {
    int ingredient_id PK
    string location PK
    decimal qty
  }
  HANDOVERS {
    int id PK
    int shift_id FK
    string kind "start / supplement"
    string status
    int issued_by FK
    int received_by FK
    int mismatch_attempts
  }
  HANDOVER_LINES {
    int id PK
    decimal issued_qty "thủ kho cân"
    decimal received_qty "bếp cân lại"
    decimal last_mismatch_qty
  }
  COUNT_SESSIONS {
    int id PK
    string kind "shift_return / periodic / spot / quick_out"
    string location
    string status "open / locked"
    int counted_by FK
  }
  COUNT_LINES {
    int id PK
    decimal book_qty
    decimal counted_qty
    decimal theoretical_qty
    decimal variance_qty "sổ - đếm"
    decimal variance_value
    string tier "ok / warn / must"
  }
  INVESTIGATIONS {
    int id PK
    decimal variance_qty
    decimal settled_qty
    datetime due_at
    string status "open / concluded"
    json suggestions
    json allocations
  }
      
```

*Bảng phụ: alerts, audit_log (chỉ ghi thêm), settings, system_clock, users. Cài đặt: backend/app/models/*

### 09. Phân quyền và phân tách nhiệm vụ

Nguyên tắc: người dùng nguyên liệu không tự xác nhận số tồn của nguyên liệu đó. Quyền được kiểm tra ở server, không chỉ ẩn nút.

| Vai trò | Được làm | Bị chặn |
|---|---|---|
| Phục vụ | Tạo đơn; sửa, hủy món chưa nấu; báo hết món | Hủy món đã bắt đầu chế biến |
| Nhân viên bếp | Bắt đầu / hoàn tất; báo hỏng, làm lại (cần PIN bếp trưởng); báo hết nguyên liệu; ghi hao hụt | Xem tồn sổ; nhập số kiểm kê hay cân trả |
| Bếp trưởng ca | Ký nhận bàn giao; xác nhận hủy / làm lại; duyệt hao hụt trong hạn mức (không phải phiếu của mình); bán lại món | Nhập số cân trả; kết luận phiếu điều tra của ca mình đã ký |
| Thủ kho | Nhập hàng; bàn giao; cân trả; kiểm kê mù; ghi hao hụt kho | Xem tồn sổ (kể cả Kho); duyệt kiểm kê của chính mình; duyệt phiếu nhập mình nhận |
| Quản lý | Mọi danh mục, ngưỡng; kiểm kê đột xuất; kết luận điều tra; dashboard, báo cáo, nhật ký | Sửa / xóa nhật ký và sổ giao dịch (DB chặn); kết luận phiếu của ca mình đã ký nhận |

*Kiêm nhiệm được phép nhưng ca bị đánh dấu sod_violation. Cài đặt: auth/security.py (require), counts._check_counter, investigations.involved_users*

## Luồng hoạt động

### 10. Một ca làm việc từ đầu đến cuối (kịch bản 1 kg bò)

Kỳ đo của nhóm A là một ca: từ lúc bếp trưởng ký nhận đến lúc thủ kho cân trả. Nhờ vậy chênh lệch gắn được với người đã ký.

```mermaid
sequenceDiagram
  autonumber
  actor TK as Thủ kho
  actor BT as Bếp trưởng
  actor PV as Phục vụ
  actor NB as Nhân viên bếp
  participant HT as Hệ thống
  actor QL as Quản lý
  TK->>HT: Phiếu nhập: nhận 1 kg bò, 250.000 đ/kg
  HT-->>HT: Kho +1000 g, đơn giá gần nhất = 250 đ/g
  TK->>HT: Bàn giao đầu ca: cân xuất 1000 g
  BT->>HT: Cân lại 1000 g + nhập PIN
  HT-->>HT: Kho -1000, Bếp +1000, ca mở, gắn bếp trưởng
  PV->>HT: Đơn bàn B3: Bò xào x5
  HT-->>NB: SSE: món mới trên danh sách
  NB->>HT: Bắt đầu
  HT-->>HT: Tiêu hao lý thuyết -100 g tại Bếp (tồn sổ Bếp 900 g)
  NB->>HT: Hoàn tất (không trừ thêm)
  Note over HT: Thực tế thịt đã hết, bếp vẫn khai còn
  HT-->>QL: Quá giờ kết thúc ca mà chưa cân trả
  TK->>HT: Cân trả mù: bò 0 g
  HT-->>HT: Chênh lệch = 900 - 0 = 900 g (900%) ≈ 225.000 đ, vượt mức bắt buộc
  HT-->>QL: Cảnh báo + phiếu điều tra, gợi ý: thất thoát trong ca (cao)
  QL->>HT: Kết luận: thất thoát trong ca 900 g
  HT-->>HT: Hao hụt ghi muộn 225.000 đ, gắn ca sáng + bếp trưởng
      
```

### 11. Ký nhận bàn giao bằng PIN

Bếp trưởng cân lại mà không thấy số thủ kho đã cân. Lệch quá dung sai (5 g) thì chưa chuyển tồn; lần ký lỗi vẫn được lưu làm bằng chứng cho phiếu điều tra sau này.

```mermaid
sequenceDiagram
  actor TK as Thủ kho
  actor BT as Bếp trưởng
  participant API as API handover
  participant L as ledger
  participant DB as PostgreSQL
  TK->>API: POST /handovers (kind start/supplement, lines)
  API->>DB: Phiếu "Chờ ký", gắn ca theo giờ
  Note over BT: Màn ký ẩn số cân xuất
  BT->>API: POST /handovers/id/sign (PIN, số cân lại)
  API->>API: verify_pin: sai 5 lần khóa 5 phút
  alt Lệch quá dung sai
    API->>DB: Lưu last_mismatch_qty, mismatch_attempts +1, nhật ký, cảnh báo
    API-->>BT: 409: cân lại trước khi ký
  else Khớp trong dung sai
    API->>L: lock(Kho, Bếp) theo thứ tự
    L->>DB: handover_out Kho -q, handover_in Bếp +q (người tạo = thủ kho, người duyệt = bếp trưởng)
    API->>DB: Phiếu "Đã ký", ca planned → open, head_chef = người ký
    API-->>BT: 200, SSE cho bếp và kho
  end
      
```

*Cài đặt: services/handover.py · auth/security.verify_pin*

### 12. Bắt đầu chế biến → trừ kho theo công thức

Nguyên liệu rời tồn lúc món chuyển Đang chế biến, không chờ Hoàn tất. Nhóm A trừ ở Bếp, nhóm C trừ ở Kho. Hủy hoặc làm lại sau khi đã bắt đầu thì đảo tiêu hao và ghi hao hụt.

```mermaid
sequenceDiagram
  actor NB as Nhân viên bếp
  participant O as orders.start_item
  participant C as catalog
  participant L as ledger
  participant A as alerts
  NB->>O: Bắt đầu món (waiting)
  O->>C: effective_version(món, now)
  C-->>O: Phiên bản công thức + lượng xuất kho/phần
  O->>L: lock tất cả (nguyên liệu, vị trí)
  loop mỗi dòng công thức
    O->>L: consumption -issue x qty (A → Bếp, C → Kho)
    opt Tồn sổ Bếp âm
      O->>A: Cảnh báo "dùng hàng chưa bàn giao?"
    end
  end
  O-->>NB: Món "Đang chế biến", lưu recipe_version_id
  Note over NB,L: Hủy sau khi bắt đầu: bếp trưởng nhập PIN → consumption_reversal +full, waste -đã dùng
      
```

*Cài đặt: services/orders.py (start_item, cancel_item, remake_item)*

### 13. Tính chênh lệch và ngưỡng hai tầng

Mọi lần chốt số thật (cân trả, kiểm kê định kỳ, đột xuất, báo hết) đi qua cùng một hàm. Chỉ coi là vượt khi vượt cả % lẫn mức tuyệt đối; kỳ không bán món nào thì chỉ xét tuyệt đối.

```mermaid
flowchart TD
  S(["Chốt số đếm của một nguyên liệu tại một vị trí"]) --> K["Khóa dòng tồn, đọc tồn sổ"]
  K --> P["Kỳ đo = từ lần đếm trước của cùng nguyên liệu, cùng vị trí"]
  P --> T["Lý thuyết = -Σ(tiêu hao + đảo tiêu hao) trong kỳ<br/>Hao hụt đã ghi = -Σ(phiếu hao hụt đúng lúc)"]
  T --> V["Chênh lệch = tồn sổ - thực đếm (dương = thiếu)<br/>% = |chênh lệch| / lý thuyết · tiền = chênh lệch x đơn giá gần nhất"]
  V --> M{"|v| > tuyệt đối bắt buộc<br/>và (lý thuyết = 0 hoặc % > 5%)?"}
  M -->|"có"| MUST["Bắt buộc duyệt<br/>giao dịch 'chênh lệch chờ giải trình'<br/>mở phiếu điều tra · cảnh báo nghiêm trọng"]
  M -->|"không"| W{"|v| > tuyệt đối cảnh báo<br/>và (lý thuyết = 0 hoặc % > 2,5%)?"}
  W -->|"có"| WARN["Mức cảnh báo<br/>tự điều chỉnh kiểm kê + hiện dashboard"]
  W -->|"không"| OK["Trong ngưỡng<br/>tự điều chỉnh, chỉ ghi nhận"]
  MUST --> TR{"3 kỳ gần nhất cùng chiều?"}
  WARN --> TR
  OK --> TR
  TR -->|"có"| TRA["Cảnh báo xu hướng"]
  TR -->|"không"| E(["Xong"])
  TRA --> E
      
```

*Ví dụ nhóm A (thịt bò): 49 bát/kg → +20 g = 2,0% → trong ngưỡng. 5 bát/kg → +900 g = 900% → bắt buộc duyệt. Cài đặt: services/variance.py (evaluate, classify, check_trend)*

### 14. Bếp báo hết nguyên liệu

"Hết" được coi là một lần kiểm kê nhanh với số đếm = 0, nên chênh lệch được tính ngay. Bếp không nhận lại tồn sổ hay chênh lệch.

```mermaid
sequenceDiagram
  actor NB as Bếp
  participant HT as outofstock
  participant V as variance
  actor PV as Phục vụ
  actor TK as Thủ kho
  actor QL as Quản lý
  NB->>HT: Báo hết nguyên liệu X (chỉ nhóm A)
  HT->>V: Kiểm kê nhanh X tại Bếp = 0
  V-->>HT: Chênh lệch + mức ngưỡng (mở phiếu nếu bắt buộc)
  HT->>HT: Khóa các món đang dùng X
  HT->>HT: Món chờ có X → "Hết nguyên liệu"
  HT-->>PV: SSE theo bàn: đổi món hoặc hủy
  opt Tồn sổ Bếp trước đó còn dương
    HT-->>QL: Cảnh báo nghiêm trọng "báo hết khi sổ còn hàng"
  end
  opt Kho còn tồn sổ
    HT-->>TK: Gợi ý bàn giao bổ sung (không kèm số lượng)
  end
  Note over QL: Phiếu từ báo hết bắt buộc kiểm kê xác nhận trước khi kết luận
  Note over NB,QL: Bán lại chỉ khi có bàn giao bổ sung, phiếu nhập hoặc kiểm kê có hàng
      
```

*Cài đặt: services/outofstock.py · catalog.resell*

### 15. Phiếu điều tra và tất toán theo nguyên nhân

Tất toán là phân loại lại, tồn không đổi: mỗi phần phân bổ ghi một giao dịch đảo khoản chờ giải trình (+q) và một giao dịch theo đúng nguyên nhân (-q). Nhờ vậy báo cáo hao hụt không lẫn lỗi nhập hàng.

```mermaid
flowchart TD
  O(["Phiếu mở: chênh lệch q, hạn 48 giờ"]) --> G["Gợi ý nguyên nhân + bằng chứng, xếp theo mức khả nghi"]
  G --> Q{"Mở từ báo hết?"}
  Q -->|"có"| VF["Bắt buộc kiểm kê xác nhận<br/>hàng tìm thấy → đảo khỏi chênh lệch"]
  Q -->|"không"| C
  VF --> C{"Người kết luận có ký nhận / đếm ca này?"}
  C -->|"có"| X["Bị chặn"]
  C -->|"không, là quản lý"| A["Phân bổ phần còn lại cho 1 hoặc nhiều nguyên nhân<br/>tổng phân bổ = phần chưa tất toán"]
  A --> N1["Nhập sai"] --> T1["Điều chỉnh có liên kết tới dòng phiếu nhập gốc<br/>không tính hao hụt · ghi lỗi cho người nhập"]
  A --> N2["Kiểm kê trước sai"] --> T1b["Điều chỉnh có liên kết"]
  A --> N3["Công thức / quy đổi sai"] --> T3["Ghi 'sai định mức' + tạo phiên bản công thức mới"]
  A --> N4["Thất thoát trong ca · hao hụt chưa ghi<br/>quá tay · làm ngoài hệ thống"] --> T4["Hao hụt ghi muộn qua điều tra<br/>gắn ca + bếp trưởng"]
  A --> N5["Không xác định"] --> T5["Thất thoát không rõ nguyên nhân, vẫn gắn ca"]
  T1 --> D(["Đã kết luận · báo cáo AvT hiện phần đã giải trình"])
  T1b --> D
  T3 --> D
  T4 --> D
  T5 --> D
      
```

*Cài đặt: services/investigations.py (suggest, verify_false_out, conclude)*

## Vòng đời

### 16. Món trong đơn

Ranh giới quan trọng là Bắt đầu. Trước ranh giới đó, hủy món không tác động kho. Sau đó, hủy cần bếp trưởng xác nhận và phần đã dùng thành hao hụt.

```mermaid
stateDiagram-v2
  state "Chờ bếp" as waiting
  state "Đang chế biến" as cooking
  state "Hoàn tất" as done
  state "Hết nguyên liệu" as out
  state "Đã hủy" as cancelled
  state "Làm lại" as remade
  [*] --> waiting: đơn được xác nhận
  waiting --> cooking: Bắt đầu, trừ kho
  cooking --> done: Hoàn tất, không trừ thêm
  waiting --> cancelled: hủy trước khi nấu, không tác động kho
  waiting --> out: báo hết nguyên liệu
  out --> cancelled: phục vụ hủy / đổi món
  cooking --> cancelled: hủy + PIN bếp trưởng, chuyển hao hụt
  done --> cancelled: hủy + PIN bếp trưởng
  cooking --> remade: làm lại + PIN, món mới về Chờ bếp
  done --> remade
  done --> [*]
  cancelled --> [*]
  remade --> [*]
      
```

### 17. Ca làm việc (mô hình kết hợp)

Giờ dự kiến lấy từ mẫu ca, dùng để cảnh báo. Kỳ đo thật được mở và đóng bằng sự kiện (ký nhận, cân trả).

```mermaid
stateDiagram-v2
  state "Chưa nhận bàn giao" as planned
  state "Đang mở" as open
  state "Đã cân trả" as closed
  [*] --> planned: sinh từ mẫu ca 06-14 / 14-22
  planned --> open: bếp trưởng ký nhận bàn giao đầu ca
  open --> open: bàn giao bổ sung · báo hết · kiểm kê đột xuất
  open --> closed: thủ kho cân trả mù
  closed --> [*]
  note right of planned: quá giờ bắt đầu 30 phút → cảnh báo chưa bàn giao
  note right of open: quá giờ kết thúc 30 phút → cảnh báo chưa cân trả
      
```

### 18. Chứng từ kho: bàn giao, phiếu nhập, phiếu hao hụt, phiên kiểm kê

Không chứng từ nào đã ghi sổ bị sửa. Muốn sửa sai thì tạo giao dịch hoặc phiên mới có liên kết tới bản gốc.

```mermaid
stateDiagram-v2
  state "Phiếu bàn giao" as H {
    state "Chờ ký" as hp
    state "Đã ký" as hs
    state "Đã hủy" as hc
    [*] --> hp
    hp --> hp: lệch cân, lưu bằng chứng
    hp --> hs: PIN, khớp dung sai, chuyển tồn
    hp --> hc: thủ kho hủy để cân lại
  }
  state "Phiếu nhập" as R {
    state "Nháp" as rd
    state "Đã nhận" as rr
    state "Chờ duyệt" as rp
    state "Đã duyệt" as ra
    state "Đã hủy" as rc
    [*] --> rd
    rd --> rr: nhận, Kho tăng ngay
    rd --> rp: lệch số đặt / giá / lịch sử
    rp --> ra: quản lý duyệt
    rd --> rc
  }
  state "Phiếu hao hụt" as W {
    state "Chờ bếp trưởng" as wc
    state "Chờ quản lý" as wm
    state "Đã duyệt" as wa
    state "Từ chối" as wr
    [*] --> wc: trong hạn mức
    [*] --> wm: vượt hạn mức
    wc --> wa
    wm --> wa
    wc --> wr: đảo giao dịch
    wm --> wr
  }
  state "Phiên kiểm kê" as K {
    state "Đang mở" as ko
    state "Đã chốt" as kl
    [*] --> ko
    ko --> kl: nhập số mù, tính chênh lệch, khóa
    kl --> [*]: sai thì tạo phiên điều chỉnh mới
  }
      
```

### 19. Phiếu điều tra

Phiếu chỉ đóng khi toàn bộ chênh lệch đã được phân bổ cho nguyên nhân.

```mermaid
stateDiagram-v2
  state "Đang mở" as open
  state "Quá hạn" as overdue
  state "Đã kết luận" as done
  [*] --> open: chênh lệch vượt mức bắt buộc duyệt
  open --> open: kiểm kê xác nhận (báo hết nhầm), tất toán một phần
  open --> overdue: quá 48 giờ, cảnh báo dashboard
  overdue --> done: quản lý kết luận
  open --> done: quản lý kết luận, tổng phân bổ = chênh lệch
  done --> [*]
      
```
