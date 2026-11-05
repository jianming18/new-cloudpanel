import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface ToolbarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  children?: ReactNode
}

export function Toolbar({ value, onChange, placeholder = '搜索…', children }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-8"
        />
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}
