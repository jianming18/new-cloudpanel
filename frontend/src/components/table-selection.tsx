import { useCallback, useMemo, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/** 表格多选状态: 支持全选 / 反选 / 清空 */
export function useTableSelection<T>(items: T[], getId: (item: T) => number) {
  const [selected, setSelected] = useState<number[]>([])

  const ids = useMemo(() => items.map(getId), [items, getId])

  const toggle = useCallback((id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.length === ids.length ? [] : ids))
  }, [ids])

  const clear = useCallback(() => setSelected([]), [])

  const allSelected = ids.length > 0 && selected.length === ids.length
  const someSelected = selected.length > 0 && !allSelected

  return { selected, toggle, toggleAll, clear, allSelected, someSelected }
}

interface SelectAllCheckboxProps {
  allSelected: boolean
  someSelected: boolean
  onToggle: () => void
}

/** 表头的全选框, 部分选中时显示半选态 */
export function SelectAllCheckbox({ allSelected, someSelected, onToggle }: SelectAllCheckboxProps) {
  return (
    <Checkbox
      checked={allSelected}
      ref={(node) => {
        if (node) node.indeterminate = someSelected
      }}
      onChange={onToggle}
      aria-label="全选"
      className={cn('rounded border-slate-300')}
    />
  )
}
