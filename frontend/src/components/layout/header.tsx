import { useState } from 'react'
import { KeyRound, LogOut, Menu, UserRound } from 'lucide-react'
import { useLocation } from 'wouter'

import { ChangePasswordDialog } from '@/components/change-password-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout } = useAuth()
  const [, navigate] = useLocation()
  const [passwordOpen, setPasswordOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus:outline-none">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-medium">{user?.name || user?.username || '未登录'}</span>
              <span className="block text-[11px] text-muted-foreground">
                {user?.roles?.includes('admin') ? '管理员' : '用户'}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{user?.username || '账号'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound />
            修改密码
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={handleLogout}>
            <LogOut />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </header>
  )
}
