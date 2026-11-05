import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: number[]
}

/** 生成带省略号的页码序列, 例如 1 … 4 5 6 … 20 */
function pageItems(current: number, count: number): (number | '...')[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)
  const items: (number | '...')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(count - 1, current + 1)
  if (start > 2) items.push('...')
  for (let index = start; index <= end; index += 1) items.push(index)
  if (end < count - 1) items.push('...')
  items.push(count)
  return items
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
    <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" title="第一页" disabled={current <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" title="上一页" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageItems(current, pageCount).map((item, index) =>
          item === '...' ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={cn(
                'h-8 min-w-8 rounded-md px-2 text-sm tabular-nums transition-colors',
                item === current
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
              )}
            >
              {item}
            </button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon"
          title="下一页"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="最后一页"
          disabled={current >= pageCount}
          onClick={() => onPageChange(pageCount)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        {onLimitChange ? (
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="h-8 w-[72px] border-slate-200 text-xs">
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
        ) : null}
        <span>
          显示 {from} - {to} / 共 {total} 条
        </span>
      </div>
    </div>
  )
}
