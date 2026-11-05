import {
  Boxes,
  Cloud,
  Droplets,
  FileCode2,
  Layers,
  LayoutDashboard,
  Server,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'wouter'

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
    title: 'AWS',
    items: [
      { href: '/aws/lightsail', label: 'Lightsail', icon: Server },
      { href: '/aws/ec2', label: 'EC2', icon: Boxes },
      { href: '/aws/accounts', label: 'AWS 账号', icon: Cloud },
    ],
  },
  {
    title: '其他云',
    items: [
      { href: '/azure', label: 'Azure', icon: Layers },
      { href: '/do', label: 'DigitalOcean', icon: Droplets },
      { href: '/linode', label: 'Linode', icon: Server },
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
  const [location] = useLocation()

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <img src="/logo.png" alt="CloudPanel" className="h-7 w-7 rounded" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">CloudPanel</div>
          <div className="text-[11px] text-muted-foreground">多云资源管理</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {group.title}
            </div>
            {group.items.map((item) => {
              const active = isActive(location, item.href)
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate}>
                  <span
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
