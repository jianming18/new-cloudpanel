import { Boxes, Cloud, Droplets, Layers, Server, type LucideIcon } from 'lucide-react'
import { Link } from 'wouter'

import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import type { Paged } from '@/lib/types'

interface Summary {
  lightsail: number
  ec2: number
  azureVm: number
  droplets: number
  linodeVm: number
  awsAccounts: number
  azureAccounts: number
  doAccounts: number
  linodeAccounts: number
}

function countOf(result: PromiseSettledResult<Paged<unknown>>): number {
  return result.status === 'fulfilled' ? (result.value?.total ?? 0) : 0
}

export function DashboardPage() {
  const { data, loading, error } = useRequest<Summary>(async (signal) => {
    const paths = [
      '/aws/lightsail/instances',
      '/aws/ec2/instances',
      '/azure/vm',
      '/do/droplets',
      '/linode/vm',
      '/aws/account',
      '/azure/account',
      '/do/account',
      '/linode/account',
    ]
    const results = await Promise.allSettled(
      paths.map((path) => api.get<Paged<unknown>>(path, { page: 1, limit: 1 }, signal)),
    )
    return {
      lightsail: countOf(results[0]),
      ec2: countOf(results[1]),
      azureVm: countOf(results[2]),
      droplets: countOf(results[3]),
      linodeVm: countOf(results[4]),
      awsAccounts: countOf(results[5]),
      azureAccounts: countOf(results[6]),
      doAccounts: countOf(results[7]),
      linodeAccounts: countOf(results[8]),
    }
  }, [])

  const cards: { title: string; value: number; hint: string; icon: LucideIcon; href: string; tone: string }[] = [
    {
      title: 'AWS 实例',
      value: (data?.lightsail ?? 0) + (data?.ec2 ?? 0),
      hint: `Lightsail ${data?.lightsail ?? 0} · EC2 ${data?.ec2 ?? 0}`,
      icon: Cloud,
      href: '/aws/ec2',
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Azure 虚拟机',
      value: data?.azureVm ?? 0,
      hint: `${data?.azureAccounts ?? 0} 个订阅`,
      icon: Layers,
      href: '/azure',
      tone: 'bg-sky-50 text-sky-600',
    },
    {
      title: 'DO Droplets',
      value: data?.droplets ?? 0,
      hint: `${data?.doAccounts ?? 0} 个账号`,
      icon: Droplets,
      href: '/do',
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Linode 实例',
      value: data?.linodeVm ?? 0,
      hint: `${data?.linodeAccounts ?? 0} 个账号`,
      icon: Server,
      href: '/linode',
      tone: 'bg-emerald-50 text-emerald-600',
    },
  ]

  return (
    <>
      <PageHeader title="仪表盘" description="各云平台资源与账号概览" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.tone}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{card.title}</div>
                  {loading ? (
                    <Skeleton className="mt-2 h-7 w-12" />
                  ) : (
                    <div className="text-2xl font-semibold tabular-nums">{card.value}</div>
                  )}
                  <div className="truncate text-xs text-muted-foreground">{card.hint}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              云账号
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="divide-y">
              {[
                { label: 'AWS', value: data?.awsAccounts ?? 0, href: '/aws/accounts' },
                { label: 'Azure', value: data?.azureAccounts ?? 0, href: '/azure' },
                { label: 'DigitalOcean', value: data?.doAccounts ?? 0, href: '/do' },
                { label: 'Linode', value: data?.linodeAccounts ?? 0, href: '/linode' },
              ].map((row) => (
                <Link key={row.label} href={row.href}>
                  <div className="flex cursor-pointer items-center justify-between py-2.5 text-sm hover:text-primary">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">{row.value}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 text-sm font-medium">快捷操作</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: '新增 Lightsail', href: '/aws/lightsail' },
                { label: '新增 EC2', href: '/aws/ec2' },
                { label: '绑定 Azure 订阅', href: '/azure' },
                { label: '绑定 Linode', href: '/linode' },
                { label: '启动脚本', href: '/scripts' },
                { label: '系统设置', href: '/settings' },
              ].map((item) => (
                <Link key={item.label} href={item.href}>
                  <div className="cursor-pointer rounded-md border border-dashed px-3 py-2.5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                    {item.label}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
