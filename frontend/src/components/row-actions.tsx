import { Loader2, MoreHorizontal, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface MoreAction {
  label: string
  icon: LucideIcon
  onClick: () => void
  destructive?: boolean
}

/** 表格行内的「更多」操作菜单, 避免一行塞太多按钮把操作列撑爆 */
export function MoreActions({ items, busy }: { items: MoreAction[]; busy?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="更多操作" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} destructive={item.destructive} onSelect={item.onClick}>
            <item.icon />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
