import { useEffect, useMemo, useState } from 'react'
import { ChartColumn, Play, Power, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
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
import { isTransient } from '@/lib/format'
import { randomName, randomPassword } from '@/lib/utils'
import type { LinodeAccountListData, LinodeVm, Paged } from '@/lib/types'

export function LinodeInstancesPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LinodeVm | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, loading, error, reload } = useRequest<Paged<LinodeVm>>(
    (signal) =>
      api.get<Paged<LinodeVm>>(
        '/linode/vm',
        { page, limit, wd, account_id: accountId === ALL_ACCOUNTS ? '' : accountId },
        signal,
      ),
    [page, limit, wd, accountId],
  )

  const { data: accountData } = useRequest<LinodeAccountListData>(
    (signal) => api.get<LinodeAccountListData>('/linode/account', { limit: 100 }, signal),
    [],
  )
  const accountOptions = (accountData?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name || item.email || `#${item.id}`,
    note: item.note,
    meta: item.balance ? `$${item.balance}` : undefined,
  }))

  async function runAction(item: LinodeVm, action: string) {
    setPendingId(item.id)
    try {
      await api.post('/linode/vm/action', { vm_id: item.instance_id, action })
      toast.success('操作成功')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setPendingId(null)
    }
  }

  const items = data?.items ?? []

  const [watching, startWatch] = useWatchWindow(180_000)
  useAutoRefresh(reload, { active: watching || items.some((item) => isTransient(item.status)) })

  const columns = useMemo<DataColumn<LinodeVm>[]>(
    () => [
      {
        key: 'instance_id',
        label: '实例ID',
        render: (item) => <span className="font-mono text-xs text-slate-700">{item.instance_id}</span>,
      },
      {
        key: 'region',
        label: '地区',
        render: (item) => <span className="text-[13px]">{item.region}</span>,
      },
      {
        key: 'image',
        label: '镜像系统',
        render: (item) => <span className="text-[13px]">{item.image || '—'}</span>,
      },
      {
        key: 'ipv4',
        label: 'IP',
        render: (item) => <span className="font-mono text-xs">{item.ipv4 || '—'}</span>,
      },
      {
        key: 'type',
        label: '型号',
        render: (item) => <span className="text-[13px]">{item.type}</span>,
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
              { label: '开机', icon: Play, onClick: () => runAction(item, 'boot') },
              { label: '关机', icon: Power, onClick: () => runAction(item, 'shutdown') },
              { label: '重启', icon: RotateCcw, onClick: () => runAction(item, 'reboot') },
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
        title="Linode 实例管理"
        icon={ChartColumn}
        fill
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <span className="text-base leading-none">+</span>
            添加
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / IP / 账号">
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

          <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
            {loading ? (
              <div className="space-y-2 px-6 py-4">
                {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
              </div>
            ) : error ? (
              <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
            ) : items.length === 0 ? (
              <EmptyState title="暂无实例" description="先添加 API Token, 再创建实例" />
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
                    info={{ ip: item.ipv4, username: 'root', password: item.password, port: '22' }}
                    extra={[
                      { label: '名称', value: item.name },
                      { label: '所属账号', value: item.account_name || item.account || '—' },
                      { label: 'IPv6', value: item.ipv6 || '—' },
                    ]}
                  />
                )}
              />
            )}

          </div>

          <Pagination
            page={page}
            limit={limit}
            total={data?.total ?? 0}
            onPageChange={setPage}
            onLimitChange={(value) => { setLimit(value); setPage(1) }}
          />
        </div>
      </PagePanel>

      <CreateLinodeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultAccountId={accountId !== ALL_ACCOUNTS ? accountId : ''}
        onCreated={() => { reload(); startWatch() }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除 Linode 实例"
        description={deleteTarget ? `将删除 ${deleteTarget.name} (${deleteTarget.ipv4})。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/linode/vm/action', { vm_id: deleteTarget.instance_id, action: 'delete' })
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

function CreateLinodeDialog({ open, onOpenChange, defaultAccountId = '', onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; defaultAccountId?: string; onCreated: () => void }) {
  const [accountId, setAccountId] = useState('')
  const [region, setRegion] = useState('')
  const [type, setType] = useState('')
  const [image, setImage] = useState('')
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

  const { data } = useRequest<LinodeAccountListData>(
    (signal) => api.get<LinodeAccountListData>('/linode/account', { limit: 100 }, signal),
    [open],
  )

  const accounts = (data?.items ?? []).filter((item) => item.status)
  const regions = data?.location_list ?? []
  const types = data?.vm_types ?? []
  const images = data?.image_list ?? []

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId || !region || !type || !image) {
      toast.error('请完整选择账号、地区、规格和镜像')
      return
    }
    setPending(true)
    try {
      await api.post('/linode/vm/create', {
        account_id: accountId,
        region,
        type,
        image_id: image,
        name,
        password,
      })
      toast.success('创建成功, 列表会自动刷新')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>创建 Linode 实例</DialogTitle>
          <DialogDescription>地区、规格与镜像来自 Linode 官方实时接口。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>账号</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="选择账号" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name || item.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>地区</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue placeholder="选择地区" /></SelectTrigger>
                <SelectContent>
                  {regions.map(([value, label]) => <SelectItem key={value} value={value}>{label} ({value})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>规格</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="选择规格" /></SelectTrigger>
                <SelectContent>
                  {types.map(([value, label]) => <SelectItem key={value} value={value}>{label} ({value})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>镜像</Label>
              <Select value={image} onValueChange={setImage}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {images.map(([value, label]) => <SelectItem key={value} value={value}>{label} ({value})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ln-vm-name">实例名称</Label>
              <div className="flex gap-2">
                <Input id="ln-vm-name" value={name} onChange={(event) => setName(event.target.value)} required className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="随机名称" onClick={() => setName(randomName())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ln-vm-password">root 密码</Label>
              <div className="flex gap-2">
                <Input id="ln-vm-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="flex-1 font-mono" />
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
