import { Fragment, type ReactNode } from 'react'

import { ExpandedRow, RowCaret } from '@/components/table-caret'
import { SelectAllCheckbox } from '@/components/table-selection'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface DataColumn<T> {
  key: string
  label: string
  render: (item: T) => ReactNode
  headClassName?: string
  cellClassName?: string
}

export interface RowSelection {
  selected: number[]
  toggle: (id: number) => void
  toggleAll: () => void
  allSelected: boolean
  someSelected: boolean
}

interface DataTableProps<T> {
  columns: DataColumn<T>[]
  items: T[]
  rowKey: (item: T) => string | number
  /** 行首是否显示展开三角 */
  expandable?: boolean
  expandedId?: string | number | null
  onToggleExpand?: (item: T) => void
  renderExpanded?: (item: T) => ReactNode
  /** 是否显示多选列 */
  selectable?: boolean
  selection?: RowSelection
  selectionId?: (item: T) => number
  onRowClick?: (item: T) => void
  /** 空状态 */
  empty?: ReactNode
}

/** 通用数据表格: 表头居中大写, 行首可展开/多选, 操作列在最右 */
export function DataTable<T>({
  columns,
  items,
  rowKey,
  expandable = false,
  expandedId = null,
  onToggleExpand,
  renderExpanded,
  selectable = false,
  selection,
  selectionId,
  onRowClick,
  empty,
}: DataTableProps<T>) {
  const colSpan = columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {expandable ? <TableHead className="w-10 pl-6 pr-0" /> : null}
          {selectable ? (
            <TableHead className="w-10 pl-4 pr-0">
              <SelectAllCheckbox
                allSelected={selection?.allSelected ?? false}
                someSelected={selection?.someSelected ?? false}
                onToggle={() => selection?.toggleAll()}
              />
            </TableHead>
          ) : null}
          {columns.map((column) => (
            <TableHead key={column.key} className={column.headClassName}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="py-14 text-center text-sm text-muted-foreground">
              {empty ?? '暂无数据'}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => {
            const key = rowKey(item)
            const expanded = expandable && expandedId === key

            return (
              <Fragment key={key}>
                <TableRow
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {expandable ? (
                    <RowCaret
                      expanded={expanded}
                      onToggle={() => onToggleExpand?.(item)}
                    />
                  ) : null}
                  {selectable ? (
                    <TableCell className="w-10 pl-4 pr-0">
                      <Checkbox
                        checked={selection?.selected.includes(selectionId?.(item) ?? 0) ?? false}
                        onChange={(event) => {
                          event.stopPropagation()
                          selection?.toggle(selectionId?.(item) ?? 0)
                        }}
                        aria-label="选择该行"
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.cellClassName}>
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
                {expanded && renderExpanded ? (
                  <ExpandedRow colSpan={colSpan}>{renderExpanded(item)}</ExpandedRow>
                ) : null}
              </Fragment>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
