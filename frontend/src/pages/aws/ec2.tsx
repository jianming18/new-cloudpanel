import { useEffect, useState } from 'react'
import { Play, Power, RefreshCw, RotateCcw, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { AccountFilter, ALL_ACCOUNTS, useAccountFilter } from '@/components/account-filter'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CredentialsDialog } from '@/components/credentials-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { MoreActions } from '@/components/row-actions'
import { Pagination } from '@/components/pagination'
import { Toolbar } from '@/components/toolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { isTransient, statusLabel, statusTone } from '@/lib/format'
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
  const [credTarget, setCredTarget] = useState<Ec2Instance | null>(null)

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

  return (
    <>
      <PageHeader
        title="EC2 实例"
        description="管理 AWS EC2 云服务器"
        actions={
          <>
            <Button variant="outline" size="icon" title="刷新列表" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>创建实例</Button>
          </>
        }
      />

      <Card>
        <div className="p-4">
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / 实例 ID / IP">
            <AccountFilter
              value={accountId}
              onChange={(value) => { setAccountId(value); setPage(1) }}
              accounts={accountOptions}
            />
          </Toolbar>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
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
                <TableHead>规格</TableHead>
                <TableHead className="hidden xl:table-cell">账号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setCredTarget(item)}>
                  <TableCell>
                    <div className="font-medium">{item.name || '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.instance_id}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.public_ip || '—'}</TableCell>
                  <TableCell>
                    <div>{item.instance_type}</div>
                    <div className="text-xs text-muted-foreground">{item.region}</div>
                  </TableCell>
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
                          { label: '终止实例', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(item) },
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
      </Card>

      <CreateEc2Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={data?.account_list ?? []}
        ec2Types={data?.ec2_types ?? []}
        defaultAccountId={accountId !== ALL_ACCOUNTS ? accountId : ''}
        onCreated={() => { reload(); startWatch() }}
      />

      <CredentialsDialog
        open={Boolean(credTarget)}
        onOpenChange={(open) => !open && setCredTarget(null)}
        info={credTarget ? {
          title: credTarget.name || credTarget.instance_id,
          description: `AWS EC2 实例 ${credTarget.instance_id}`,
          ip: credTarget.public_ip,
          username: 'root',
          password: credTarget.password,
          port: '22',
        } : null}
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
            toast.error(err instanceof Error ? err.message : '操作失败')
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
