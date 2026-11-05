import { useEffect, useState } from 'react'
import { Cloud, Pencil, Play, Power, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AccountFilter, ALL_ACCOUNTS, useAccountFilter } from '@/components/account-filter'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton, CredentialsDialog } from '@/components/credentials-dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAutoRefresh, useWatchWindow } from '@/hooks/use-auto-refresh'
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { isTransient, maskSecret, statusLabel, statusTone } from '@/lib/format'
import { randomName, randomPassword } from '@/lib/utils'
import type { LinodeAccount, LinodeAccountListData, LinodeVm, Paged } from '@/lib/types'

export function LinodePage() {
  return (
    <PagePanel title="Linode 实例与账号" description="管理 Linode 实例与 API Token" icon={Cloud}>
      <Tabs defaultValue="vm">
        <TabsList>
          <TabsTrigger value="vm">实例</TabsTrigger>
          <TabsTrigger value="account">账号</TabsTrigger>
        </TabsList>
        <TabsContent value="vm"><LinodeVmTab /></TabsContent>
        <TabsContent value="account"><LinodeAccountTab /></TabsContent>
      </Tabs>
    </PagePanel>
  )
}

function LinodeVmTab() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LinodeVm | null>(null)
  const [credTarget, setCredTarget] = useState<LinodeVm | null>(null)

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

  return (
    <>
      <div>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / IP / 账号" />
          <div className="flex items-center gap-2">
            <AccountFilter
              value={accountId}
              onChange={(value) => { setAccountId(value); setPage(1) }}
              accounts={accountOptions}
            />
            <Button variant="outline" size="icon" title="刷新列表" onClick={reload}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>创建实例</Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无实例" description="先添加 API Token, 再创建实例" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>实例</TableHead>
                <TableHead>IPv4</TableHead>
                <TableHead>规格 / 地区</TableHead>
                <TableHead>镜像</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setCredTarget(item)}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">实例ID: {item.instance_id}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.ipv4 || '—'}</TableCell>
                  <TableCell>
                    <div>{item.type}</div>
                    <div className="text-xs text-muted-foreground">{item.region}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.image}</TableCell>
                  <TableCell><Badge tone={statusTone(item.status)}>{statusLabel(item.status, item.status_text)}</Badge></TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="开机" disabled={pendingId === item.id} onClick={() => runAction(item, 'boot')}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="关机" disabled={pendingId === item.id} onClick={() => runAction(item, 'shutdown')}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <MoreActions
                        busy={pendingId === item.id}
                        items={[
                          { label: '重启', icon: RotateCcw, onClick: () => runAction(item, 'reboot') },
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

        <Pagination page={page} limit={limit} total={data?.total ?? 0} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1) }} />
      </div>

      <CreateLinodeDialog
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
          description: `Linode 实例 #${credTarget.instance_id}`,
          ip: credTarget.ipv4,
          username: 'root',
          password: credTarget.password,
          port: '22',
        } : null}
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

function LinodeAccountTab() {
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LinodeAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LinodeAccount | null>(null)

  const { data, loading, error, reload } = useRequest<LinodeAccountListData>(
    (signal) => api.get<LinodeAccountListData>('/linode/account', { wd: keyword, limit: 100 }, signal),
    [keyword],
  )

  const items = data?.items ?? []

  return (
    <>
      <div>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Toolbar value={keyword} onChange={setKeyword} placeholder="搜索邮箱 / Token" />
          <Button onClick={() => setCreateOpen(true)}>添加账号</Button>
        </div>

        {loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无账号" description="需要 Linode Personal Access Token (Read/Write)" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>实例</TableHead>
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
                  <TableCell className="tabular-nums">{item.count}</TableCell>
                  <TableCell className="tabular-nums">{item.balance}</TableCell>
                  <TableCell><Badge tone={item.status ? 'success' : 'muted'}>{item.status ? '正常' : '异常'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
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
      </div>

      <AddLinodeAccountDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={reload} />

      <EditLinodeAccountDialog target={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} onSaved={reload} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除账号"
        description={deleteTarget ? `将删除 ${deleteTarget.email} 的记录。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/linode/account/delete', { account_id: deleteTarget.id })
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

/** Linode Token 固定为 64 位十六进制; 整段复制时自动提取其中的 Token */
function extractLinodeToken(raw: string): string {
  const compact = raw.replace(/\s+/g, '')
  if (/^[0-9a-fA-F]{64}$/.test(compact)) return compact
  const matched = raw.match(/[0-9a-fA-F]{64}/g) ?? []
  return matched.length === 1 ? matched[0] : compact
}

function AddLinodeAccountDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const cleanToken = extractLinodeToken(token)
    if (!/^[0-9a-fA-F]{64}$/.test(cleanToken)) {
      toast.error(`Token 格式不正确: 应为 64 位十六进制字符(当前 ${cleanToken.length} 位)`)
      return
    }
    setPending(true)
    try {
      await api.post('/linode/account', { token: cleanToken, name, note })
      toast.success('账号已添加, 正在同步实例')
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
          <DialogTitle>添加 Linode 账号</DialogTitle>
          <DialogDescription>令牌需要 Linodes 读写和 Account 读取权限。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ln-name">名称</Label>
            <Input id="ln-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="可选" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-token">API Token</Label>
            <Input id="ln-token" value={token} onChange={(event) => setToken(event.target.value)} required className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-note">备注</Label>
            <Textarea id="ln-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
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

/** 编辑 Linode 账号: 名称/备注可改, Token 明文展示可复制 */
function EditLinodeAccountDialog({ target, onOpenChange, onSaved }: { target: LinodeAccount | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
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
      await api.post('/linode/account', { account_id: target.id, name, note })
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
          <DialogTitle>编辑 Linode 账号</DialogTitle>
          <DialogDescription>Token 明文展示仅供核对与复制, 如需更换请删除账号后重新添加。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ln-edit-name">名称</Label>
            <Input id="ln-edit-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-edit-token">API Token (明文)</Label>
            <div className="flex gap-2">
              <Input id="ln-edit-token" value={target?.token ?? ''} readOnly className="flex-1 font-mono text-xs" />
              <CopyButton value={target?.token ?? ''} label="Token" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-edit-note">备注</Label>
            <Input id="ln-edit-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" />
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
                  {types.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>镜像</Label>
              <Select value={image} onValueChange={setImage}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {images.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
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
