import { useState } from 'react'
import {
  Boxes,
  ChevronsUpDown,
  Cloud,
  Droplets,
  FileCode2,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Server,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'wouter'

import { ChangePasswordDialog } from '@/components/change-password-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '概览',
    items: [{ href: '/', label: '仪表盘', icon: LayoutDashboard }],
  },
  {
    title: 'AWS 管理',
    items: [
      { href: '/aws/accounts', label: '账号列表', icon: Users },
      { href: '/aws/ec2', label: '实例管理', icon: Boxes },
      { href: '/aws/lightsail', label: 'Lightsail 管理', icon: Server },
    ],
  },
  {
    title: 'Azure 管理',
    items: [{ href: '/azure', label: '账号与实例', icon: Layers }],
  },
  {
    title: 'DigitalOcean 管理',
    items: [{ href: '/do', label: '账号与实例', icon: Droplets }],
  },
  {
    title: 'Linode 管理',
    items: [{ href: '/linode', label: '账号与实例', icon: Cloud }],
  },
  {
    title: '系统',
    items: [
      { href: '/scripts', label: '启动脚本', icon: FileCode2 },
      { href: '/settings', label: '设置', icon: Settings },
    ],
  },
]

function isActive(current: string, href: string) {
  if (href === '/') return current === '/'
  return current === href || current.startsWith(`${href}/`)
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [location, navigate] = useLocation()
  const { user, logout } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-[#1e1f2e] text-slate-300">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <img src="/logo.png" alt="CloudPanel" className="h-7 w-7 rounded-md" />
        <span className="text-[15px] font-semibold text-white">CloudPanel</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-1 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mt-5 first:mt-2">
            <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-white/30">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(location, item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={onNavigate}>
                    <span
                      className={cn(
                        'relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] transition-colors',
                        active
                          ? 'bg-white/[0.08] font-medium text-white'
                          : 'text-white/55 hover:bg-white/[0.05] hover:text-white/90',
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
                      ) : null}
                      <item.icon className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-primary' : 'text-white/40')} strokeWidth={1.8} />
                      <span className="truncate">{item.label}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.06] focus:outline-none">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[13px] font-semibold text-primary">
                {(user?.name || user?.username || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-medium text-white/90">
                  {user?.name || user?.username || '未登录'}
                </span>
                <span className="block truncate text-[11px] text-white/35">
                  {user?.roles?.includes('admin') ? '管理员' : '用户'}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/30" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound />
              修改密码
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleLogout}>
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </aside>
  )
}
