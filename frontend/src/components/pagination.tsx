import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(page, pageCount)
  const from = total === 0 ? 0 : (current - 1) * limit + 1
  const to = Math.min(current * limit, total)

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span>
          共 <span className="font-medium text-foreground">{total}</span> 条
          {total > 0 ? ` · 当前 ${from}-${to}` : ''}
        </span>
        {onLimitChange ? (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">每页</span>
            <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
              <SelectTrigger className="h-8 w-[74px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          <ChevronLeft className="h-4 w-4" />
          上一页
        </Button>
        <span className="px-2 tabular-nums">
          {current} / {pageCount}
        </span>
        <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>
          下一页
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
