import { useEffect, useMemo, useState } from 'react'
import { ChartColumn, Play, Power, RefreshCw, RotateCcw, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { AccountFilter, ALL_ACCOUNTS, useAccountFilter } from '@/components/account-filter'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type DataColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { InstanceDetail } from '@/components/instance-detail'
import { PagePanel } from '@/components/page-panel'
import { Pagination } from '@/components/pagination'
import { MoreActions } from '@/components/row-actions'
import { Toolbar } from '@/components/toolbar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAutoRefresh, useWatchWindow } from '@/hooks/use-auto-refresh'
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { formatDate, isTransient } from '@/lib/format'
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
  const [expandedId, setExpandedId] = useState<number | null>(null)

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

  const columns = useMemo<DataColumn<LightsailInstance>[]>(
    () => [
      {
        key: 'name',
        label: '实例ID',
        render: (item) => <span className="font-mono text-xs text-slate-700">{item.name}</span>,
      },
      {
        key: 'region',
        label: '地区',
        render: (item) => <span className="text-[13px]">{item.region}</span>,
      },
      {
        key: 'os_name',
        label: '镜像系统',
        render: (item) => <span className="text-[13px]">{item.os_name || '—'}</span>,
      },
      {
        key: 'ip',
        label: 'IP',
        render: (item) => <span className="font-mono text-xs">{item.public_ip || '—'}</span>,
      },
      {
        key: 'price',
        label: '型号',
        render: (item) => <span className="tabular-nums text-[13px]">${item.price}</span>,
      },
      {
        key: 'status',
        label: '状态',
        render: (item) => <span className="text-[13px] text-slate-600">{item.status}</span>,
      },
      {
        key: 'actions',
        label: 'ACTIONS',
        render: (item) => (
          <MoreActions
            withLabel
            busy={pendingId === item.id}
            items={[
              { label: '开机', icon: Play, onClick: () => runAction(item, 'start') },
              { label: '关机', icon: Power, onClick: () => runAction(item, 'stop') },
              { label: '重启', icon: RotateCcw, onClick: () => runAction(item, 'restart') },
              { label: '更换 IP', icon: Zap, onClick: () => runAction(item, 'reset_ip') },
              { label: '刷新状态', icon: RefreshCw, onClick: () => runAction(item, 'update') },
              { label: '删除实例', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(item) },
            ]}
          />
        ),
      },
    ],
    [pendingId],
  )

  return (
    <>
      <PagePanel
        title="Lightsail 实例管理"
        icon={ChartColumn}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <span className="text-base leading-none">+</span>
            添加
          </Button>
        }
      >
        <div>
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / IP / 地区">
              <AccountFilter
                value={accountId}
                onChange={(value) => { setAccountId(value); setPage(1) }}
                accounts={accountOptions}
              />
              <Button
                variant="outline"
                size="icon"
                title="刷新列表"
                onClick={reload}
                className="border-slate-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </Toolbar>

          {loading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
          ) : items.length === 0 ? (
            <EmptyState title="暂无实例" description="点击右上角「添加」开始" />
          ) : (
            <DataTable
              columns={columns}
              items={items}
              rowKey={(item) => item.id}
              expandable
              expandedId={expandedId}
              onToggleExpand={(item) => setExpandedId((prev) => (prev === item.id ? null : item.id))}
              renderExpanded={(item) => (
                <InstanceDetail
                  info={{ ip: item.public_ip, username: 'root', password: item.password, port: '22' }}
                  extra={[
                    { label: '所属账号', value: item.account || '—' },
                    { label: '创建时间', value: formatDate(item.create_time) },
                    { label: '到期时间', value: formatDate(item.expire_time) },
                  ]}
                />
              )}
            />
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
