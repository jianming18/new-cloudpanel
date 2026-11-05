import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PagePanelProps {
  title: string
  description?: string
  icon?: LucideIcon
  /** 标题右侧的操作区 */
  actions?: ReactNode
  children: ReactNode
  /** 内容区留白, 表格类页面传 p-0 由表格自身控制间距 */
  bodyClassName?: string
}

/** 主区域的白底面板: 顶部标题栏 + 内容, 对应设计稿的卡片式布局 */
export function PagePanel({ title, description, icon: Icon, actions, children, bodyClassName }: PagePanelProps) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] ring-1 ring-slate-900/[0.04]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? <Icon className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.9} /> : null}
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight text-slate-800">{title}</h1>
            {description ? <p className="mt-0.5 truncate text-xs text-slate-400">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('p-0', bodyClassName)}>{children}</div>
    </section>
  )
}
