import { ChevronRight } from 'lucide-react'

import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface RowCaretProps {
  expanded: boolean
  onToggle: () => void
  label?: string
}

/** 行首的展开三角: 点击展开/收起详情行 */
export function RowCaret({ expanded, onToggle, label = '展开详情' }: RowCaretProps) {
  return (
    <TableCell className="w-10 pl-4 pr-0">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        title={expanded ? '收起' : label}
        aria-label={label}
        aria-expanded={expanded}
        className="flex h-6 w-6 items-center justify-center rounded text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
      </button>
    </TableCell>
  )
}

interface ExpandedRowProps {
  colSpan: number
  children: React.ReactNode
}

/** 展开后的详情行: 跨列显示 */
export function ExpandedRow({ colSpan, children }: ExpandedRowProps) {
  return (
    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
      <TableCell colSpan={colSpan} className="whitespace-normal px-6 py-4 text-left">
        {children}
      </TableCell>
    </TableRow>
  )
}
