import { useEffect, useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AccountFilter, ALL_ACCOUNTS, useAccountFilter } from '@/components/account-filter'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton, CredentialsDialog } from '@/components/credentials-dialog'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAutoRefresh, useWatchWindow } from '@/hooks/use-auto-refresh'
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { isTransient, maskSecret, statusLabel, statusTone } from '@/lib/format'
import { randomName, randomPassword } from '@/lib/utils'
import type { DoAccount, Droplet, DropletListData, Paged } from '@/lib/types'

export function DigitalOceanPage() {
  return (
    <>
      <PageHeader title="DigitalOcean" description="管理 Droplets 与 API Token" />
      <Tabs defaultValue="droplets">
        <TabsList>
          <TabsTrigger value="droplets">Droplets</TabsTrigger>
          <TabsTrigger value="account">账号</TabsTrigger>
        </TabsList>
        <TabsContent value="droplets"><DropletTab /></TabsContent>
        <TabsContent value="account"><DoAccountTab /></TabsContent>
      </Tabs>
    </>
  )
}

function DropletTab() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Droplet | null>(null)
  const [credTarget, setCredTarget] = useState<Droplet | null>(null)

  const { data, loading, error, reload } = useRequest<DropletListData>(
    (signal) =>
      api.get<DropletListData>(
        '/do/droplets',
        { page, limit, wd, account_id: accountId === ALL_ACCOUNTS ? '' : accountId },
        signal,
      ),
    [page, limit, wd, accountId],
  )

  const accountOptions = (data?.account_list ?? []).map((item) => ({
    id: item.id,
    name: item.name || `#${item.id}`,
    note: item.note,
  }))

  const items = data?.items ?? []

  const [watching, startWatch] = useWatchWindow(180_000)
  useAutoRefresh(reload, { active: watching || items.some((item) => isTransient(item.status)) })

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / IP" />
          <div className="flex items-center gap-2">
            <AccountFilter
              value={accountId}
              onChange={(value) => { setAccountId(value); setPage(1) }}
              accounts={accountOptions}
            />
            <Button variant="outline" size="icon" title="刷新列表" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>创建 Droplet</Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无 Droplet" description="先添加 API Token, 再创建实例" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Droplet</TableHead>
                <TableHead>公网 IP</TableHead>
                <TableHead>规格</TableHead>
                <TableHead>镜像 / 地区</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setCredTarget(item)}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">实例ID: {item.droplet_id}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.ip || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{item.vcpus} vCPU · {item.memory}MB</TableCell>
                  <TableCell>
                    <div>{item.image_slug || '—'}</div>
                    <div className="text-xs text-muted-foreground">{item.region_slug}</div>
                  </TableCell>
                  <TableCell><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <Button variant="ghost" size="icon" title="删除" className="text-destructive" onClick={() => setDeleteTarget(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination page={page} limit={limit} total={data?.total ?? 0} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1) }} />
      </Card>

      <CreateDropletDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={data?.account_list ?? []}
        images={data?.image_list ?? []}
        regions={data?.region_list ?? []}
        sizes={data?.price_list ?? []}
        defaultAccountId={accountId !== ALL_ACCOUNTS ? accountId : ''}
        onCreated={() => { reload(); startWatch() }}
      />

      <CredentialsDialog
        open={Boolean(credTarget)}
        onOpenChange={(open) => !open && setCredTarget(null)}
        info={credTarget ? {
          title: credTarget.name,
          description: `DigitalOcean Droplet #${credTarget.droplet_id}`,
          ip: credTarget.ip,
          username: 'root',
          password: credTarget.password,
          port: '22',
        } : null}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除 Droplet"
        description={deleteTarget ? `将删除 ${deleteTarget.name} (${deleteTarget.ip})。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.delete('/do/droplets', { server_id: deleteTarget.id })
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

function DoAccountTab() {
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DoAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DoAccount | null>(null)

  const { data, loading, error, reload } = useRequest<Paged<DoAccount>>(
    (signal) => api.get<Paged<DoAccount>>('/do/account', { wd: keyword, limit: 100 }, signal),
    [keyword],
  )

  const items = data?.items ?? []

  async function syncAccount(item: DoAccount) {
    try {
      await api.get('/do/account/update', { account_id: item.id })
      toast.success('同步完成')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '同步失败')
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Toolbar value={keyword} onChange={setKeyword} placeholder="搜索邮箱 / Token" />
          <Button onClick={() => setCreateOpen(true)}>添加账号</Button>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无账号" description="需要 DigitalOcean 个人访问令牌 (Read/Write)" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>实例 / 额度</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{item.email}</div>
                    {item.note ? <div className="text-xs text-muted-foreground">备注: {item.note}</div> : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{maskSecret(item.token)}</TableCell>
                  <TableCell className="tabular-nums">{item.server_count} / {item.droplet_limit}</TableCell>
                  <TableCell className="tabular-nums">{item.month_to_date_balance || '—'}</TableCell>
                  <TableCell><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="同步" onClick={() => syncAccount(item)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="编辑" onClick={() => setEditTarget(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="删除" className="text-destructive" onClick={() => setDeleteTarget(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AddDoAccountDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={reload} />

      <EditDoAccountDialog target={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} onSaved={reload} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除账号"
        description={deleteTarget ? `将删除 ${deleteTarget.email} 的记录。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.delete('/do/account', { account_id: deleteTarget.id })
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

function AddDoAccountDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await api.post('/do/account', { token, name, note })
      toast.success('账号已添加')
      onOpenChange(false)
      setToken('')
      setName('')
      setNote('')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加 DigitalOcean 账号</DialogTitle>
          <DialogDescription>令牌需要 Read / Write 权限。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="do-name">名称</Label>
            <Input id="do-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="可选" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do-token">API Token</Label>
            <Input id="do-token" value={token} onChange={(event) => setToken(event.target.value)} required className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do-note">备注</Label>
            <Input id="do-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? '校验中…' : '添加'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 编辑 DO 账号: 名称/备注可改, Token 明文展示可复制 */
function EditDoAccountDialog({ target, onOpenChange, onSaved }: { target: DoAccount | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (target) {
      setName(target.name ?? '')
      setNote(target.note ?? '')
    }
  }, [target])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!target) return
    setPending(true)
    try {
      await api.post('/do/account', { account_id: target.id, name, note })
      toast.success('账号已保存')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑 DO 账号</DialogTitle>
          <DialogDescription>Token 明文展示仅供核对与复制, 如需更换请删除账号后重新添加。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="do-edit-name">名称</Label>
            <Input id="do-edit-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do-edit-token">API Token (明文)</Label>
            <div className="flex gap-2">
              <Input id="do-edit-token" value={target?.token ?? ''} readOnly className="flex-1 font-mono text-xs" />
              <CopyButton value={target?.token ?? ''} label="Token" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="do-edit-note">备注</Label>
            <Input id="do-edit-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateDropletDialog({
  open,
  onOpenChange,
  accounts,
  images,
  regions,
  sizes,
  defaultAccountId = '',
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: { id: number; name: string }[]
  images: string[]
  regions: [string, string][]
  sizes: [string, string][]
  defaultAccountId?: string
  onCreated: () => void
}) {
  const [accountId, setAccountId] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [image, setImage] = useState('')
  const [region, setRegion] = useState('sgp1')
  const [size, setSize] = useState('s-1vcpu-1gb')
  const [count, setCount] = useState('1')
  const [pending, setPending] = useState(false)

  // 打开对话框时预填页面筛选器中选中的账号, 并生成随机名称与随机 root 密码
  useEffect(() => {
    if (open) {
      if (defaultAccountId) setAccountId(defaultAccountId)
      setName(randomName())
      setPassword(randomPassword())
    }
  }, [open, defaultAccountId])

  const sizeOptions = sizes

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!accountId || !image) {
      toast.error('请选择账号和镜像')
      return
    }
    setPending(true)
    try {
      await api.post('/do/droplets', {
        account_id: accountId,
        name,
        password,
        image_id: image,
        region,
        type: size,
        count,
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
          <DialogTitle>创建 Droplet</DialogTitle>
          <DialogDescription>密码会通过 cloud-init 写入实例, 创建后即可用 root 登录。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>账号</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="选择账号" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name || `#${item.id}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>镜像</Label>
              <Select value={image} onValueChange={setImage}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {images.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
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
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue placeholder="选择规格" /></SelectTrigger>
                <SelectContent>
                  {(sizeOptions.length ? sizeOptions : [['s-1vcpu-1gb', '1 vCPU / 1GB']]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label} ({value})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="do-droplet-name">名称</Label>
              <div className="flex gap-2">
                <Input id="do-droplet-name" value={name} onChange={(event) => setName(event.target.value)} required className="flex-1" />
                <Button type="button" variant="outline" size="icon" title="随机名称" onClick={() => setName(randomName())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="do-droplet-password">root 密码</Label>
              <div className="flex gap-2">
                <Input id="do-droplet-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="flex-1 font-mono" />
                <Button type="button" variant="outline" size="icon" title="重新生成密码" onClick={() => setPassword(randomPassword())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="do-droplet-count">数量</Label>
              <Input id="do-droplet-count" type="number" min={1} max={5} value={count} onChange={(event) => setCount(event.target.value)} />
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
