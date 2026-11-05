import { useState } from 'react'
import {
  ChevronsUpDown,
  FileCode2,
  Gem,
  KeyRound,
  LayoutGrid,
  LogOut,
  Settings,
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
  /** 分组标题, 展示为大写的小号灰字 */
  title: string
  items: NavItem[]
}

/** 账号/实例两类页面在各厂商下通用, 因此图标统一用网格样式 */
const GRID_ICON = LayoutGrid

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Azure 管理',
    items: [
      { href: '/azure/accounts', label: '账号列表', icon: GRID_ICON },
      { href: '/azure/instances', label: '实例管理', icon: GRID_ICON },
    ],
  },
  {
    title: 'AWS 管理',
    items: [
      { href: '/aws/accounts', label: '账号列表', icon: GRID_ICON },
      { href: '/aws/instances', label: '实例管理', icon: GRID_ICON },
    ],
  },
  {
    title: 'Lightsail 管理',
    items: [{ href: '/aws/lightsail', label: '实例管理', icon: GRID_ICON }],
  },
  {
    title: 'DigitalOcean 管理',
    items: [
      { href: '/do/accounts', label: '账号列表', icon: GRID_ICON },
      { href: '/do/instances', label: '实例管理', icon: GRID_ICON },
    ],
  },
  {
    title: 'Linode 管理',
    items: [
      { href: '/linode/accounts', label: '账号列表', icon: GRID_ICON },
      { href: '/linode/instances', label: '实例管理', icon: GRID_ICON },
    ],
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
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-[#1e2033] text-slate-300">
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <Link href="/" onClick={onNavigate}>
          <span
            className={cn(
              'mb-5 flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] transition-colors',
              location === '/' ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white/90',
            )}
          >
            <Gem className="h-[17px] w-[17px] shrink-0 text-primary" strokeWidth={1.9} />
            <span className="truncate">Dashboard</span>
          </span>
        </Link>

        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mt-5 first:mt-0">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                          ? 'bg-white/[0.06] font-medium text-primary'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
                      ) : null}
                      <item.icon
                        className={cn('h-[17px] w-[17px] shrink-0', active ? 'text-primary' : 'text-slate-500')}
                        strokeWidth={1.8}
                      />
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
