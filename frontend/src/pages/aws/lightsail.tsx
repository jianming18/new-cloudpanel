import { useEffect, useState } from 'react'
import { Play, Power, RefreshCw, RotateCcw, Server, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { AccountFilter, ALL_ACCOUNTS, useAccountFilter } from '@/components/account-filter'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CredentialsDialog } from '@/components/credentials-dialog'
import { EmptyState } from '@/components/empty-state'
import { PagePanel } from '@/components/page-panel'
import { MoreActions } from '@/components/row-actions'
import { Pagination } from '@/components/pagination'
import { Toolbar } from '@/components/toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAutoRefresh, useWatchWindow } from '@/hooks/use-auto-refresh'
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { formatDate, isTransient, statusLabel, statusTone } from '@/lib/format'
import { randomName, randomPassword } from '@/lib/utils'
import type { AwsAccount, AwsRegion, LightsailBundle, LightsailImages, LightsailInstance, Paged } from '@/lib/types'

export function LightsailPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LightsailInstance | null>(null)
  const [credTarget, setCredTarget] = useState<LightsailInstance | null>(null)

  const { data, loading, error, reload } = useRequest<Paged<LightsailInstance>>(
    (signal) =>
      api.get<Paged<LightsailInstance>>(
        '/aws/lightsail/instances',
        { page, limit, wd, account_id: accountId === ALL_ACCOUNTS ? '' : accountId },
        signal,
      ),
    [page, limit, wd, accountId],
  )

  // 账号下拉的数据源, 用于按账号过滤实例
  const { data: accountData } = useRequest<Paged<AwsAccount>>(
    (signal) => api.get<Paged<AwsAccount>>('/aws/account', { limit: 100 }, signal),
    [],
  )
  const accountOptions = (accountData?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name || item.email || `#${item.id}`,
    note: item.note,
  }))

  async function runAction(item: LightsailInstance, action: string) {
    setPendingId(item.id)
    try {
      await api.post('/aws/lightsail/action', { action, server_id: item.id })
      toast.success(action === 'update' ? '状态已刷新' : '操作成功')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setPendingId(null)
    }
  }

  const items = data?.items ?? []

  // 创建后的同步窗口内 + 存在过渡态实例时自动刷新
  const [watching, startWatch] = useWatchWindow(120_000)
  useAutoRefresh(reload, { active: watching || items.some((item) => isTransient(item.status)) })

  return (
    <>
      <PagePanel
        title="Lightsail 实例"
        description="管理 AWS Lightsail 轻量服务器"
        icon={Server}
        actions={
          <>
            <Button variant="outline" size="icon" title="刷新列表" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>创建实例</Button>
          </>
        }
      >
        <div>
          <div className="border-b border-slate-100 px-6 py-4">
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / IP / 地区">
            <AccountFilter
              value={accountId}
              onChange={(value) => { setAccountId(value); setPage(1) }}
              accounts={accountOptions}
            />
          </Toolbar>
        </div>

        {loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无实例" description="点击右上角「创建实例」开始" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>实例</TableHead>
                <TableHead>公网 IP</TableHead>
                <TableHead>地区</TableHead>
                <TableHead className="hidden xl:table-cell">账号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setCredTarget(item)}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(item.create_time)}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.public_ip || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{item.region}</TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{item.account}</TableCell>
                  <TableCell>
                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status, item.status_text)}</Badge>
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="开机" disabled={pendingId === item.id} onClick={() => runAction(item, 'start')}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="关机" disabled={pendingId === item.id} onClick={() => runAction(item, 'stop')}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <MoreActions
                        busy={pendingId === item.id}
                        items={[
                          { label: '重启', icon: RotateCcw, onClick: () => runAction(item, 'restart') },
                          { label: '更换 IP', icon: Zap, onClick: () => runAction(item, 'reset_ip') },
                          { label: '刷新状态', icon: RefreshCw, onClick: () => runAction(item, 'update') },
                          { label: '删除实例', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(item) },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          page={page}
          limit={limit}
          total={data?.total ?? 0}
          onPageChange={setPage}
          onLimitChange={(value) => { setLimit(value); setPage(1) }}
        />
        </div>
      </PagePanel>

      <CreateLightsailDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultAccountId={accountId !== ALL_ACCOUNTS ? accountId : ''}
        onCreated={() => { reload(); startWatch() }}
      />

      <CredentialsDialog
        open={Boolean(credTarget)}
        onOpenChange={(open) => !open && setCredTarget(null)}
        info={credTarget ? {
          title: credTarget.name,
          description: 'AWS Lightsail 实例',
          ip: credTarget.public_ip,
          username: 'root',
          password: credTarget.password,
          port: '22',
        } : null}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除 Lightsail 实例"
        description={deleteTarget ? `将删除实例 ${deleteTarget.name}, 该操作不可恢复。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/aws/lightsail/action', { action: 'delete', server_id: deleteTarget.id })
            toast.success('删除成功')
            reload()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : '删除失败')
          }
        }}
      />
    </>
  )
}

function CreateLightsailDialog({
  open,
  onOpenChange,
  defaultAccountId = '',
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultAccountId?: string
  onCreated: () => void
}) {
  const [accountId, setAccountId] = useState('')
  const [region, setRegion] = useState('')
  const [blueprint, setBlueprint] = useState('')
  const [bundle, setBundle] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  // 打开对话框时预填页面筛选器中选中的账号, 并生成随机名称与随机 root 密码
  useEffect(() => {
    if (open) {
      if (defaultAccountId) setAccountId(defaultAccountId)
      setName(randomName())
      setPassword(randomPassword())
    }
  }, [open, defaultAccountId])

  const { data: accounts } = useRequest<Paged<AwsAccount>>(
    (signal) => api.get<Paged<AwsAccount>>('/aws/account', { limit: 100 }, signal),
    [open],
  )

  const { data: regions } = useRequest<{ items: AwsRegion[] }>(
    (signal) => (accountId ? api.get<{ items: AwsRegion[] }>('/aws/lightsail/region', { account_id: accountId }, signal) : Promise.resolve({ items: [] })),
    [accountId, open],
  )

  const { data: images } = useRequest<LightsailImages>(
    (signal) =>
      accountId && region
        ? api.get<LightsailImages>('/aws/lightsail/images', { account_id: accountId, region }, signal)
        : Promise.resolve({ bundles: [], blueprints: [] }),
    [accountId, region, open],
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId || !region || !blueprint || !bundle) {
      toast.error('请先选择账号、地区、镜像和套餐')
      return
    }
    setPending(true)
    try {
      await api.post('/aws/lightsail/create', {
        account_id: accountId,
        region,
        images_id: blueprint,
        bundle,
        name,
        password,
      })
      toast.success('创建成功, 列表会自动刷新')
      onOpenChange(false)
      onCreated()
      setName('')
      setPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建 Lightsail 实例</DialogTitle>
          <DialogDescription>选择账号和地区后会自动加载可用镜像与套餐。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>账号</Label>
              <Select value={accountId} onValueChange={(value) => { setAccountId(value); setRegion(''); setBlueprint(''); setBundle('') }}>
                <SelectTrigger><SelectValue placeholder="选择账号" /></SelectTrigger>
                <SelectContent>
                  {(accounts?.items ?? []).filter((item) => item.status).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.name || item.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>地区</Label>
              <Select value={region} onValueChange={(value) => { setRegion(value); setBlueprint(''); setBundle('') }} disabled={!accountId}>
                <SelectTrigger><SelectValue placeholder="选择地区" /></SelectTrigger>
                <SelectContent>
                  {(regions?.items ?? []).map((item) => (
                    <SelectItem key={item.region} value={item.region}>{item.name} ({item.region})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>系统镜像</Label>
              <Select value={blueprint} onValueChange={setBlueprint} disabled={!region}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {(images?.blueprints ?? []).map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>套餐</Label>
              <Select value={bundle} onValueChange={setBundle} disabled={!region}>
                <SelectTrigger><SelectValue placeholder="选择套餐" /></SelectTrigger>
                <SelectContent>
                  {(images?.bundles ?? []).map((item: LightsailBundle) => (
                    <SelectItem key={item.bundleId} value={item.bundleId}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ls-name">实例名称</Label>
              <div className="flex gap-2">
                <Input id="ls-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="my-server" className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="随机名称" onClick={() => setName(randomName())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-password">root 密码</Label>
              <div className="flex gap-2">
                <Input id="ls-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="至少 8 位" className="flex-1 font-mono" />
                <Button type="button" variant="outline" size="icon" title="重新生成密码" onClick={() => setPassword(randomPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? '创建中…' : '创建'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
