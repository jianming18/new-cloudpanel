import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** 移动端顶部条: 桌面端导航常驻左侧, 这里只保留抽屉入口 */
export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
      <Button variant="ghost" size="icon" onClick={onOpenSidebar}>
        <Menu className="h-5 w-5" />
      </Button>
      <img src="/logo.png" alt="CloudPanel" className="h-6 w-6 rounded" />
      <span className="text-sm font-semibold text-slate-800">CloudPanel</span>
    </header>
  )
}
