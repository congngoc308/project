import { useQuery } from "@tanstack/react-query"
import { BarChart3, Download } from "@/components/icons"
import { useMemo, useState } from "react"

import { GroupBadge, LocationBadge, Loading, PageHeader, TierBadge } from "@/components/common"
import { DataTable, type ColumnDef } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, qs } from "@/lib/api"
import { useServerNow } from "@/lib/clock"
import { isoDay, money, pct, qty, signedQty } from "@/lib/format"
import type { Ingredient, Tier } from "@/lib/types"

interface AvtRow {
  ingredient_id: number
  ingredient: string
  group: "A" | "C"
  unit: string
  location: "kho" | "bep"
  shift_id: number | null
  shift: string | null
  head_chef: string | null
  theoretical: number
  recorded_waste: number
  actual: number
  unexplained: number
  pct: number | null
  value: number
  tier: Tier
  counts: number
  explained: { cause: string; label: string; qty: number; value: number }[]
  pending_qty: number
}

export function useDateRange(defaultDays = 7) {
  const now = useServerNow(60_000)
  const today = isoDay(now)
  const [from, setFrom] = useState(() => isoDay(new Date(now.getTime() - (defaultDays - 1) * 86_400_000)))
  const [to, setTo] = useState(today)
  const presets = [
    { label: "Hôm nay", days: 1 },
    { label: "7 ngày", days: 7 },
    { label: "30 ngày", days: 30 },
  ]
  const control = (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <Button key={p.label} size="sm" variant="outline"
          onClick={() => { setTo(today); setFrom(isoDay(new Date(now.getTime() - (p.days - 1) * 86_400_000))) }}>
          {p.label}
        </Button>
      ))}
      <Input type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày" />
      <span className="text-muted-foreground">→</span>
      <Input type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày" />
    </div>
  )
  return { from, to, control }
}

export function AvtPage() {
  const { from, to, control } = useDateRange(7)
  const [location, setLocation] = useState("all")
  const [ingredient, setIngredient] = useState("all")
  const [byShift, setByShift] = useState(false)
  const ings = useQuery({ queryKey: ["ingredients"], queryFn: () => api.get<Ingredient[]>("/ingredients") })
  const params = { date_from: from, date_to: to, location: location === "all" ? "" : location, ingredient_id: ingredient === "all" ? "" : ingredient, by_shift: byShift }
  const q = useQuery({ queryKey: ["avt", params], queryFn: () => api.get<{ rows: AvtRow[]; total_value: number; total_shortage_value: number }>(`/reports/avt${qs(params)}`) })

  const columns = useMemo<ColumnDef<AvtRow, unknown>[]>(() => [
    { accessorKey: "ingredient", header: "Nguyên liệu", cell: ({ row }) => <span className="font-medium">{row.original.ingredient} <GroupBadge group={row.original.group} /></span> },
    { accessorKey: "location", header: "Vị trí", cell: ({ row }) => <LocationBadge location={row.original.location} /> },
    ...(byShift ? [{ accessorKey: "shift", header: "Ca", cell: ({ row }: { row: { original: AvtRow } }) => <span>{row.original.shift ?? "-"}<div className="text-xs text-muted-foreground">{row.original.head_chef}</div></span> } as ColumnDef<AvtRow, unknown>] : []),
    { accessorKey: "theoretical", header: "Lý thuyết", meta: { numeric: true }, cell: ({ row }) => qty(row.original.theoretical, row.original.unit) },
    { accessorKey: "recorded_waste", header: "Hao hụt đã ghi", meta: { numeric: true }, cell: ({ row }) => qty(row.original.recorded_waste, row.original.unit) },
    { accessorKey: "actual", header: "Thực tế", meta: { numeric: true }, cell: ({ row }) => qty(row.original.actual, row.original.unit) },
    { accessorKey: "unexplained", header: "Chưa giải thích", meta: { numeric: true }, cell: ({ row }) => <span className="font-medium">{signedQty(row.original.unexplained, row.original.unit)}</span> },
    { accessorKey: "pct", header: "%", meta: { numeric: true }, cell: ({ row }) => pct(row.original.pct) },
    { id: "value", accessorFn: (r) => Math.abs(Number(r.value)), header: "Giá trị", meta: { numeric: true }, cell: ({ row }) => <span className="font-semibold">{money(row.original.value)}</span> },
    { accessorKey: "tier", header: "Mức", cell: ({ row }) => <TierBadge tier={row.original.tier} /> },
    {
      id: "explained", header: "Đã giải trình / chờ", enableSorting: false,
      cell: ({ row }) => (
        <div className="space-y-0.5 text-xs">
          {row.original.explained.map((e) => <div key={e.cause}>{e.label}: {qty(e.qty, row.original.unit)} · {money(e.value)}</div>)}
          {Number(row.original.pending_qty) !== 0 && <div className="font-medium text-warning-ink">Chờ giải trình {qty(row.original.pending_qty, row.original.unit)}</div>}
          {!row.original.explained.length && Number(row.original.pending_qty) === 0 && <span className="text-muted-foreground">-</span>}
        </div>
      ),
    },
  ], [byShift])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Báo cáo AvT: thực tế so với lý thuyết"
        icon={BarChart3}
        description="Lý thuyết = định lượng × số món đã bán. Chênh lệch chưa giải thích = thực tế − lý thuyết − hao hụt đã ghi (= tồn sổ − tồn kiểm kê). Mặc định sắp theo giá trị tiền."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/reports/avt.xlsx${qs(params)}`}><Download className="size-4" /> Xuất Excel</a>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3 surface p-3">
        {control}
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-36" aria-label="Vị trí"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Mọi vị trí</SelectItem><SelectItem value="bep">Bếp</SelectItem><SelectItem value="kho">Kho</SelectItem></SelectContent>
        </Select>
        <Select value={ingredient} onValueChange={setIngredient}>
          <SelectTrigger className="w-48" aria-label="Nguyên liệu"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi nguyên liệu</SelectItem>
            {(ings.data ?? []).map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox checked={byShift} onCheckedChange={(v) => setByShift(!!v)} /> Tách theo ca
        </Label>
      </div>
      {q.isLoading || !q.data ? <Loading /> : (
        <>
          <div className="flex flex-wrap gap-6 text-sm">
            <span>Tổng giá trị chênh lệch: <b>{money(q.data.total_value)}</b></span>
            <span>Phần thiếu: <b className="text-critical-ink">{money(q.data.total_shortage_value)}</b></span>
          </div>
          <div aria-busy={q.isFetching}>
            <DataTable columns={columns} data={q.data.rows} initialSort={[{ id: "value", desc: true }]} empty="Không có số liệu trong kỳ" />
          </div>
        </>
      )}
    </div>
  )
}
