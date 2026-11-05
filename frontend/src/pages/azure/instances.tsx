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
import type { AzureAccountListData, AzureVm, Paged } from '@/lib/types'

export function AzureInstancesPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AzureVm | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, loading, error, reload } = useRequest<Paged<AzureVm>>(
    (signal) =>
      api.get<Paged<AzureVm>>(
        '/azure/vm',
        { page, limit, wd, account_id: accountId === ALL_ACCOUNTS ? '' : accountId },
        signal,
      ),
    [page, limit, wd, accountId],
  )

  const { data: accountData } = useRequest<AzureAccountListData>(
    (signal) => api.get<AzureAccountListData>('/azure/account', { limit: 100 }, signal),
    [],
  )
  const accountOptions = (accountData?.items ?? []).map((item) => ({
    id: item.id,
    name: item.display_name || item.email || `#${item.id}`,
    note: item.note,
  }))

  async function runAction(item: AzureVm, action: string) {
    setPendingId(item.id)
    try {
      await api.post('/azure/vm/action', { vm_id: item.vm_id, action })
      toast.success(action === 'update' ? '状态已刷新' : '操作已提交')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setPendingId(null)
    }
  }

  const items = data?.items ?? []

  // Azure 建机是队列任务, 通常要几分钟, 这里给更长的自动刷新窗口
  const [watching, startWatch] = useWatchWindow(360_000)
  useAutoRefresh(reload, { active: watching || items.some((item) => isTransient(item.status)) })

  const columns = useMemo<DataColumn<AzureVm>[]>(
    () => [
      {
        key: 'vm_id',
        label: '实例ID',
        render: (item) => <span className="font-mono text-xs text-slate-700">{item.vm_id}</span>,
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
        key: 'ip',
        label: 'IP',
        render: (item) => <span className="font-mono text-xs">{item.ip || '—'}</span>,
      },
      {
        key: 'vm_size',
        label: '型号',
        render: (item) => <span className="text-[13px]">{item.vm_size}</span>,
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
              { label: '刷新状态', icon: RefreshCw, onClick: () => runAction(item, 'update') },
              { label: '删除虚拟机', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(item) },
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
        title="Azure 实例管理"
        icon={ChartColumn}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <span className="text-base leading-none">+</span>
            添加
          </Button>
        }
      >
        <div>
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

          {loading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
          ) : items.length === 0 ? (
            <EmptyState title="暂无虚拟机" description="先添加订阅账号, 再创建虚拟机" />
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
                  info={{ ip: item.ip, username: item.username || 'azureuser', password: item.password, port: '22' }}
                  extra={[
                    { label: '名称', value: item.name },
                    { label: '所属账号', value: item.account || '—' },
                    { label: '资源组', value: item.group || '—' },
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

      <CreateAzureVmDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultAccountId={accountId !== ALL_ACCOUNTS ? accountId : ''}
        onCreated={() => { reload(); startWatch() }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除虚拟机"
        description={deleteTarget ? `将删除 ${deleteTarget.name} 及其磁盘、网卡等资源。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/azure/vm/action', { vm_id: deleteTarget.vm_id, action: 'delete' })
            toast.success('删除已提交')
            reload()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : '删除失败')
          }
        }}
      />
    </>
  )
}

function CreateAzureVmDialog({ open, onOpenChange, defaultAccountId = '', onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; defaultAccountId?: string; onCreated: () => void }) {
  const [accountId, setAccountId] = useState('')
  const [region, setRegion] = useState('eastasia')
  const [imageId, setImageId] = useState('')
  const [vmSize, setVmSize] = useState('Standard_B1s')
  const [diskSize, setDiskSize] = useState('64')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  // 打开对话框时预填页面筛选器中选中的订阅, 并生成随机名称与随机密码
  useEffect(() => {
    if (open) {
      if (defaultAccountId) setAccountId(defaultAccountId)
      setName(randomName())
      setPassword(randomPassword())
    }
  }, [open, defaultAccountId])

  const { data } = useRequest<AzureAccountListData>(
    (signal) => api.get<AzureAccountListData>('/azure/account', { limit: 100 }, signal),
    [open],
  )

  const accounts = (data?.items ?? []).filter((item) => item.status === 'Enabled')
  const images = Object.entries(data?.image_list ?? {})
  const regions = Object.entries(data?.location_list ?? {})
  const sizes = Object.entries(data?.vm_sizes ?? {})

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId || !imageId) {
      toast.error('请选择订阅和镜像')
      return
    }
    setPending(true)
    try {
      await api.post('/azure/vm/create', {
        account_id: accountId,
        region,
        image_id: imageId,
        type: vmSize,
        disk_size: diskSize,
        name,
        password,
      })
      toast.success('已加入创建队列, 约 5 分钟后完成, 列表会自动刷新')
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
          <DialogTitle>创建 Azure 虚拟机</DialogTitle>
          <DialogDescription>创建任务在后台执行, 通常需要 5 分钟左右。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>订阅</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="选择订阅" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.display_name || item.email}</SelectItem>)}
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
              <Label>镜像</Label>
              <Select value={imageId} onValueChange={setImageId}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {images.map(([value, label]) => <SelectItem key={value} value={value}>{label} ({value})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="az-size">规格</Label>
              <Input id="az-size" list="az-size-options" value={vmSize} onChange={(event) => setVmSize(event.target.value)} />
              <datalist id="az-size-options">
                {sizes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="az-disk">系统盘 (GB)</Label>
              <Input id="az-disk" type="number" min={30} value={diskSize} onChange={(event) => setDiskSize(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="az-name">名称</Label>
              <div className="flex gap-2">
                <Input id="az-name" value={name} onChange={(event) => setName(event.target.value)} required className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="随机名称" onClick={() => setName(randomName())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="az-password">密码</Label>
              <div className="flex gap-2">
                <Input id="az-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="flex-1 font-mono" />
                <Button type="button" variant="outline" size="icon" title="重新生成密码" onClick={() => setPassword(randomPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? '提交中…' : '创建'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
