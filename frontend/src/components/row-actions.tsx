import { Loader2, MoreHorizontal, Settings, type LucideIcon } from 'lucide-react'

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

interface MoreActionsProps {
  items: MoreAction[]
  busy?: boolean
  /** 带文字的触发器(齿轮图标 + 更多操作), 与设计稿一致 */
  withLabel?: boolean
}

/** 表格行内的「更多」操作菜单, 避免一行塞太多按钮把操作列撑爆 */
export function MoreActions({ items, busy, withLabel = false }: MoreActionsProps) {
  if (withLabel) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[13px] text-slate-500 transition-colors hover:text-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            更多操作
          </button>
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="更多操作" disabled={busy} className="text-slate-400 hover:text-primary">
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

interface RowActionButtonsProps {
  children: React.ReactNode
}

/** 行内图标操作组: 统一用主色描边, 与设计稿一致 */
export function RowActionButtons({ children }: RowActionButtonsProps) {
  return <div className="flex items-center justify-center gap-0.5">{children}</div>
}

interface ActionButtonProps {
  icon: LucideIcon
  title: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}

/** 单个图标操作按钮 */
export function ActionButton({ icon: Icon, title, onClick, disabled, destructive }: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={destructive ? 'h-8 w-8 text-rose-500 hover:text-rose-600' : 'h-8 w-8 text-primary hover:text-primary/80'}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
