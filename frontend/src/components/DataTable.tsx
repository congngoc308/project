import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp } from "@/components/icons"
import { useState } from "react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type { ColumnDef }

/** Bảng có sắp xếp theo cột; cột số đặt meta.numeric để căn phải và dùng chữ số đều. */
export function DataTable<T>({
  columns,
  data,
  initialSort,
  onRowClick,
  empty = "Không có dữ liệu",
  rowClassName,
}: {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  initialSort?: SortingState
  onRowClick?: (row: T) => void
  empty?: string
  rowClassName?: (row: T) => string | undefined
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? [])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <div className="overflow-x-auto surface">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
              {hg.headers.map((h) => {
                const numeric = (h.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric
                const sorted = h.column.getIsSorted()
                return (
                  <TableHead key={h.id} className={cn("text-xs leading-tight whitespace-normal", numeric && "text-right")}>
                    {h.isPlaceholder ? null : !h.column.getCanSort() || !h.column.columnDef.header ? flexRender(h.column.columnDef.header, h.getContext()) : (
                      <button
                        type="button"
                        className={cn("inline-flex items-center gap-1", h.column.getCanSort() ? "cursor-pointer" : "cursor-default")}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sorted === "asc" && <ArrowUp className="size-3" />}
                        {sorted === "desc" && <ArrowDown className="size-3" />}
                      </button>
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">{empty}</TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onRowClick(row.original)
                }
              } : undefined}
              className={cn(onRowClick && "cursor-pointer", rowClassName?.(row.original))}
            >
              {row.getVisibleCells().map((cell) => {
                const numeric = (cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric
                return (
                  <TableCell key={cell.id} className={cn("text-sm", numeric && "text-right tabular")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
