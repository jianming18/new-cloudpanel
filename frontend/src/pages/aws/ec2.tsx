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
import { isTransient } from '@/lib/format'
import { randomName, randomPassword } from '@/lib/utils'
import type { AwsAccount, AwsRegion, Ec2Instance, Ec2ListData, Paged, ScriptItem } from '@/lib/types'

export function Ec2Page() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Ec2Instance | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, loading, error, reload } = useRequest<Ec2ListData>(
    (signal) =>
      api.get<Ec2ListData>(
        '/aws/ec2/instances',
        { page, limit, wd, account_id: accountId === ALL_ACCOUNTS ? '' : accountId },
        signal,
      ),
    [page, limit, wd, accountId],
  )

  const { data: accountData } = useRequest<Paged<AwsAccount>>(
    (signal) => api.get<Paged<AwsAccount>>('/aws/account', { limit: 100 }, signal),
    [],
  )
  const accountOptions = (accountData?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name || item.email || `#${item.id}`,
    note: item.note,
  }))

  async function runAction(item: Ec2Instance, action: string) {
    setPendingId(item.id)
    try {
      await api.post('/aws/ec2/action', { action, server_id: item.id })
      toast.success(action === 'update' ? '状态已刷新' : '操作成功')
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

  const columns = useMemo<DataColumn<Ec2Instance>[]>(
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
        render: (item) => <span className="text-[13px]">{item.image_name || '—'}</span>,
      },
      {
        key: 'ip',
        label: 'IP',
        render: (item) => <span className="font-mono text-xs">{item.public_ip || '—'}</span>,
      },
      {
        key: 'type',
        label: '型号',
        render: (item) => <span className="text-[13px]">{item.instance_type}</span>,
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
              { label: '终止实例', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(item) },
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
        title="EC2 实例管理"
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
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / 实例 ID / IP">
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
                    info={{ ip: item.public_ip, username: item.username || 'root', password: item.password, port: '22' }}
                    extra={[
                      { label: '名称', value: item.name || '—' },
                      { label: '所属账号', value: item.account || '—' },
                      { label: '规格', value: item.instance_type },
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

      <CreateEc2Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={data?.account_list ?? []}
        ec2Types={data?.ec2_types ?? []}
        defaultAccountId={accountId !== ALL_ACCOUNTS ? accountId : ''}
        onCreated={() => { reload(); startWatch() }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="终止 EC2 实例"
        description={deleteTarget ? `将终止实例 ${deleteTarget.name || deleteTarget.instance_id}, 该操作不可恢复。` : ''}
        confirmText="确认终止"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/aws/ec2/action', { action: 'delete', server_id: deleteTarget.id })
            toast.success('已提交终止')
            reload()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : '删除失败')
          }
        }}
      />
    </>
  )
}

function CreateEc2Dialog({
  open,
  onOpenChange,
  accounts,
  ec2Types,
  defaultAccountId = '',
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: { id: number; name: string }[]
  ec2Types: string[]
  defaultAccountId?: string
  onCreated: () => void
}) {
  const [accountId, setAccountId] = useState('')
  const [region, setRegion] = useState('')
  const [imageId, setImageId] = useState('')
  const [ec2Type, setEc2Type] = useState('t3.micro')
  const [disk, setDisk] = useState('20')
  const [count, setCount] = useState('1')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [scriptId, setScriptId] = useState('')
  const [pending, setPending] = useState(false)

  // 打开对话框时预填页面筛选器中选中的账号, 并生成随机名称与随机 root 密码
  useEffect(() => {
    if (open) {
      if (defaultAccountId) setAccountId(defaultAccountId)
      setName(randomName())
      setPassword(randomPassword())
    }
  }, [open, defaultAccountId])

  const { data: regions } = useRequest<{ items: AwsRegion[] }>(
    (signal) => (accountId ? api.get<{ items: AwsRegion[] }>('/aws/ec2/region', { account_id: accountId }, signal) : Promise.resolve({ items: [] })),
    [accountId, open],
  )

  const { data: images } = useRequest<Paged<{ id: number; name: string }>>(
    (signal) => (region ? api.get<Paged<{ id: number; name: string }>>('/aws/ec2/images', { region }, signal) : Promise.resolve({ total: 0, items: [] })),
    [region, open],
  )

  const { data: scripts } = useRequest<Paged<ScriptItem>>(
    (signal) => api.get<Paged<ScriptItem>>('/passport/scripts', { limit: 100 }, signal),
    [open],
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId || !region || !imageId) {
      toast.error('请先选择账号、地区和镜像')
      return
    }
    setPending(true)
    try {
      await api.post('/aws/ec2/create', {
        account_id: accountId,
        region,
        images_id: imageId,
        ec2_type: ec2Type,
        ec2_disk: disk,
        ec2_count: count,
        name,
        password,
        script_id: scriptId,
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
          <DialogTitle>创建 EC2 实例</DialogTitle>
          <DialogDescription>机型清单来自 AWS 实时接口, 可输入关键字筛选。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>账号</Label>
              <Select value={accountId} onValueChange={(value) => { setAccountId(value); setRegion(''); setImageId('') }}>
                <SelectTrigger><SelectValue placeholder="选择账号" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>地区</Label>
              <Select value={region} onValueChange={(value) => { setRegion(value); setImageId('') }} disabled={!accountId}>
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
              <Select value={imageId} onValueChange={setImageId} disabled={!region}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {(images?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ec2-type">实例规格</Label>
              <Input
                id="ec2-type"
                list="ec2-type-options"
                value={ec2Type}
                onChange={(event) => setEc2Type(event.target.value)}
                placeholder="t3.micro"
              />
              <datalist id="ec2-type-options">
                {ec2Types.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec2-disk">磁盘 (GB)</Label>
              <Input id="ec2-disk" type="number" min={10} value={disk} onChange={(event) => setDisk(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec2-count">数量</Label>
              <Input id="ec2-count" type="number" min={1} max={5} value={count} onChange={(event) => setCount(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>启动脚本</Label>
              <Select value={scriptId} onValueChange={setScriptId}>
                <SelectTrigger><SelectValue placeholder="不使用" /></SelectTrigger>
                <SelectContent>
                  {(scripts?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ec2-name">实例名称</Label>
              <div className="flex gap-2">
                <Input id="ec2-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="web-01" className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="随机名称" onClick={() => setName(randomName())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec2-password">root 密码</Label>
              <div className="flex gap-2">
                <Input id="ec2-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="至少 8 位" className="flex-1 font-mono" />
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
