import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface ToolbarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  children?: ReactNode
}

/** 工具栏: 左侧搜索框, 右侧操作按钮组 */
export function Toolbar({ value, onChange, placeholder = '搜索…', children }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center">
      <div className="relative w-full sm:max-w-[280px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {children ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  )
}
