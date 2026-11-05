import { Info, Settings2 } from 'lucide-react'

import { PagePanel } from '@/components/page-panel'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import type { SiteOptions } from '@/lib/types'

export function SettingsPage() {
  const { user } = useAuth()
  const { data, loading, error } = useRequest<{ options: SiteOptions }>(
    (signal) => api.get<{ options: SiteOptions }>('/passport/get/options', undefined, signal),
    [],
  )

  const options = data?.options ?? {}
  const entries = Object.entries(options)
  const version = document.querySelector('meta[name="version"]')?.getAttribute('content') || ''

  return (
    <PagePanel title="设置" description="站点配置与账号信息" icon={Settings2} bodyClassName="space-y-4 p-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              站点配置
            </CardTitle>
            <CardDescription>站点级配置由后端维护, 前端仅做展示。</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-8 w-full" />)}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无配置项</p>
            ) : (
              <div className="divide-y">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{key}</span>
                    <span className="max-w-[60%] truncate text-right">
                      {typeof value === 'boolean' ? (value ? '是' : '否') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                当前账号
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">用户名</span>
                <span className="font-medium">{user?.username || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">角色</span>
                <Badge tone={user?.roles?.includes('admin') ? 'success' : 'muted'}>
                  {user?.roles?.includes('admin') ? '管理员' : '普通用户'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">注册时间</span>
                <span>{user?.create_time || '—'}</span>
              </div>
              {version && version !== '__VERSION__' ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">前端版本</span>
                  <span className="font-mono text-xs">{version}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </PagePanel>
  )
}
