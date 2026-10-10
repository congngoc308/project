export type Role = "server" | "kitchen" | "head_chef" | "storekeeper" | "manager"
export type Tier = "ok" | "warn" | "must"
export type Num = number | string

export interface Shift {
  id: number
  name: string
  business_date: string
  planned_start: string
  planned_end: string
  status: "planned" | "open" | "closed"
  opened_at: string | null
  closed_at: string | null
  head_chef_id: number | null
  head_chef?: string | null
  sod_violation: boolean
  sod_notes: string
}

export interface Me {
  id: number
  username: string
  full_name: string
  roles: Role[]
  role_labels: string[]
  now: string
  clock_offset: number
  demo_mode: boolean
  shift: Shift | null
}

export interface StaffUser {
  id: number
  username: string
  full_name: string
  roles: Role[]
  role_labels: string[]
}

export interface Meta {
  roles: Record<Role, string>
  locations: Record<string, string>
  txn_types: Record<string, string>
  waste_types: Record<string, { group: string; label: string }>
  manual_waste_types: string[]
  causes: Record<string, string>
  count_kinds: Record<string, string>
  tiers: Record<Tier, string>
  item_statuses: Record<string, string>
  settings: Settings
}

export interface Settings {
  thresholds: Record<"A" | "C", { warn_pct: number; warn_abs: number; must_pct: number; must_abs: number }>
  investigation_due_hours: number
  handover_tolerance: number
  trend_periods: number
  return_grace_minutes: number
  handover_sign_grace_minutes: number
  receipt_price_tolerance_pct: number
  receipt_history_ratio: number
  cancel_anomaly_min: number
}

export interface Ingredient {
  id: number
  code: string
  name: string
  category: string
  control_group: "A" | "C"
  base_unit: string
  purchase_unit: string
  last_unit_cost: Num
  min_stock: Num
  shelf_life_days: number | null
  warn_pct: Num | null
  warn_abs: Num | null
  must_pct: Num | null
  must_abs: Num | null
  waste_limit: Num | null
  active: boolean
  units: string[]
  conversions: { id: number; unit: string; factor: Num; base_unit: string; specific: boolean }[]
  book_kho?: Num
  book_bep?: Num
}

export interface RecipeLine {
  ingredient_id: number
  ingredient: string
  group: "A" | "C"
  base_unit: string
  qty: Num
  unit: string
  prep_loss_pct: Num
  note: string
  net_qty_base: Num
  issue_qty_base: Num
  unit_cost: Num
  cost: Num
}

export interface RecipeVersion {
  id: number
  version_no: number
  effective_from: string
  reason: string
  created_by: number
  created_by_name?: string
  created_at: string
  current?: boolean
  lines: RecipeLine[]
}

export interface MenuItem {
  id: number
  code: string
  name: string
  category: string
  price: Num
  status: "selling" | "stopped"
  locked: boolean
  locks: { id: number; reason: string; ingredient_id: number | null; locked_at: string }[]
  sellable: boolean
  recipe?: RecipeVersion | null
}

export interface OrderItem {
  id: number
  order_id: number
  order_code: string
  table: string
  menu_item_id: number
  name: string
  qty: number
  note: string
  status: "waiting" | "cooking" | "done" | "out_of_stock" | "cancelled" | "remade"
  seq: number | null
  started_at: string | null
  done_at: string | null
  ended_at: string | null
  end_reason: string | null
  remake_of_id: number | null
  confirmed_at: string | null
  /** Phục vụ đã mang món ra bàn (chỉ có ở món đã hoàn tất). */
  served_at: string | null
}

export interface Order {
  id: number
  code: string
  table: string
  status: string
  opened_at: string
  confirmed_at: string | null
  items: OrderItem[]
}

export interface HandoverLine {
  id: number
  ingredient_id: number
  ingredient: string
  unit: string
  issued_qty: Num | null
  received_qty: Num | null
  last_mismatch_qty: Num | null
}

export interface Handover {
  id: number
  code: string
  kind: "start" | "supplement"
  status: "pending" | "signed" | "cancelled"
  shift: Shift
  issued_by: string
  issued_at: string
  received_by: string | null
  signed_at: string | null
  mismatch_attempts: number
  note: string
  lines: HandoverLine[]
}

export interface CountLine {
  id: number
  ingredient_id: number
  ingredient: string
  unit: string
  group: "A" | "C"
  counted_qty?: Num
  book_qty?: Num
  theoretical_qty?: Num
  recorded_waste_qty?: Num
  variance_qty?: Num
  variance_pct?: Num | null
  variance_value?: Num
  tier?: Tier
  period_start?: string | null
}

export interface CountSession {
  id: number
  code: string
  kind: string
  kind_label: string
  location: "kho" | "bep"
  status: "open" | "locked"
  opened_at: string
  cutoff_at: string | null
  shift: Shift | null
  created_by: string
  counted_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  note: string
  corrects_session_id: number | null
  revealed: boolean
  lines: CountLine[]
}

export interface Suggestion {
  cause: string
  label: string
  score: number
  level: "cao" | "trung bình" | "thấp"
  evidence: string[]
  support: "auto" | "required" | "manual"
}

export interface Allocation {
  cause: string
  qty: number
  value: number
  by: number
  at: string
  note: string
  receipt_line_id?: number
}

export interface Investigation {
  id: number
  code: string
  ingredient: { id: number; name: string; unit: string; group: "A" | "C" }
  location: "kho" | "bep"
  shift: { id: number; name: string; business_date: string } | null
  responsible: string | null
  variance_qty: Num
  variance_value: Num
  settled_qty: Num
  opened_at: string
  due_at: string
  status: "open" | "concluded"
  overdue: boolean
  due_soon: boolean
  concluded_at: string | null
  concluded_by: string | null
  conclusion_note: string | null
  allocations: Allocation[]
  count?: {
    session_id: number
    code: string
    kind: string
    cutoff_at: string
    period_start: string | null
    book_qty: Num
    counted_qty: Num
    theoretical_qty: Num
    recorded_waste_qty: Num
    variance_pct: Num | null
    unit_cost: Num
    counted_by: string | null
  }
  suggestions?: Suggestion[]
  needs_verification?: boolean
  involved_user_ids?: number[]
  receipt_lines?: {
    id: number
    receipt_code: string
    supplier: string
    received_at: string
    received_qty: Num
    unit: string
    received_qty_base: Num
  }[]
}

export interface Alert {
  id: number
  at: string
  kind: string
  severity: "info" | "warn" | "critical"
  title: string
  body: string | null
  ingredient_id: number | null
  location: string | null
  shift_id: number | null
  ref_type: string | null
  ref_id: number | null
  status: string
}

export interface ReceiptLine {
  id: number
  ingredient_id: number
  ingredient: string
  base_unit: string
  unit: string
  ordered_qty: Num
  received_qty: Num | null
  unit_price: Num
  expiry_date: string | null
  diff_reason: string | null
  received_qty_base: Num | null
  unit_cost_base: Num | null
  linked_adjustment: Num
}

export interface Receipt {
  id: number
  code: string
  supplier: string
  order_date: string | null
  received_at: string | null
  status: "draft" | "received" | "pending_approval" | "approved" | "cancelled"
  anomalies: string[]
  invoice_image: string | null
  note: string
  created_by: string
  received_by: string | null
  approved_by: string | null
  approved_at: string | null
  lines: ReceiptLine[]
}

export interface WasteSlip {
  id: number
  at: string
  ingredient_id: number
  ingredient: string
  unit: string
  location: "kho" | "bep"
  qty: Num
  value: number
  waste_type: string
  type_label: string
  type_group: string
  reason: string
  status: "pending_chef" | "pending_manager" | "approved" | "rejected"
  created_by: string
  approved_by: string | null
  approved_at: string | null
  order_item_id: number | null
  shift_id: number | null
}
