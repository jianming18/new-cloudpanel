import { useEffect, useState } from 'react'
import { Layers, Pencil, Play, Power, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
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
import type { AzureAccount, AzureAccountListData, AzureVm, Paged } from '@/lib/types'

export function AzurePage() {
  return (
    <PagePanel title="Azure 虚拟机与订阅" description="管理 Azure 订阅与虚拟机" icon={Layers}>
      <Tabs defaultValue="vm">
        <TabsList>
          <TabsTrigger value="vm">虚拟机</TabsTrigger>
          <TabsTrigger value="account">订阅账号</TabsTrigger>
        </TabsList>
        <TabsContent value="vm"><AzureVmTab /></TabsContent>
        <TabsContent value="account"><AzureAccountTab /></TabsContent>
      </Tabs>
    </PagePanel>
  )
}

function AzureVmTab() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [accountId, setAccountId] = useAccountFilter()
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AzureVm | null>(null)
  const [credTarget, setCredTarget] = useState<AzureVm | null>(null)

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
            <Button onClick={() => setCreateOpen(true)}>创建虚拟机</Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无虚拟机" description="先添加订阅账号, 再创建虚拟机" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>虚拟机</TableHead>
                <TableHead>公网 IP</TableHead>
                <TableHead>规格</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => setCredTarget(item)}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">实例ID: {item.vm_id}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.ip || '—'}</TableCell>
                  <TableCell>
                    <div>{item.vm_size}</div>
                    <div className="text-xs text-muted-foreground">{item.region}</div>
                  </TableCell>
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
                          { label: '刷新状态', icon: RefreshCw, onClick: () => runAction(item, 'update') },
                          { label: '删除虚拟机', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(item) },
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

      <CreateAzureVmDialog
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
          description: `Azure 虚拟机 ${credTarget.vm_id}`,
          ip: credTarget.ip,
          username: credTarget.username || 'azureuser',
          password: credTarget.password,
          port: '22',
        } : null}
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

function AzureAccountTab() {
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AzureAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AzureAccount | null>(null)

  const { data, loading, error, reload } = useRequest<AzureAccountListData>(
    (signal) => api.get<AzureAccountListData>('/azure/account', { wd: keyword, limit: 100 }, signal),
    [keyword],
  )

  const items = data?.items ?? []

  async function syncAccount(item: AzureAccount) {
    try {
      await api.post('/azure/account/action', { account_id: item.id, action: 'update' })
      toast.success('已提交同步')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '同步失败')
    }
  }

  return (
    <>
      <div>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Toolbar value={keyword} onChange={setKeyword} placeholder="搜索订阅 / 邮箱 / AppID" />
          <Button onClick={() => setCreateOpen(true)}>添加订阅</Button>
        </div>

        {loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState title="暂无订阅" description="需要 Azure AD 应用的 AppID / Secret / Tenant" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订阅</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>AppID</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead>虚拟机</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.display_name || item.email}
                    {item.note ? <div className="text-xs font-normal text-muted-foreground">备注: {item.note}</div> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.email}</TableCell>
                  <TableCell className="font-mono text-xs">{maskSecret(item.client_id)}</TableCell>
                  <TableCell className="font-mono text-xs">{maskSecret(item.password)}</TableCell>
                  <TableCell className="tabular-nums">{item.vm_count}</TableCell>
                  <TableCell><Badge tone={statusTone(item.status)}>{statusLabel(item.status, item.status_text)}</Badge></TableCell>
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
      </div>

      <AzureAccountDialog
        open={createOpen || Boolean(editTarget)}
        account={editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditTarget(null)
          }
        }}
        onSaved={reload}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除订阅"
        description={deleteTarget ? `将删除订阅 ${deleteTarget.display_name || deleteTarget.email} 的记录。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/azure/account/delete', { account_id: deleteTarget.id })
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

function AzureAccountDialog({
  open,
  account,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  account: AzureAccount | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [email, setEmail] = useState('')
  const [appId, setAppId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [password, setPassword] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  // 打开时回填 (编辑模式), App Secret / 登录密码按需求明文展示
  useEffect(() => {
    if (open) {
      setEmail(account?.email ?? '')
      setAppId(account?.client_id ?? '')
      setTenantId(account?.tenant_id ?? '')
      setPassword(account?.password ?? '')
      setLoginPassword(account?.login_password ?? '')
      setNote(account?.note ?? '')
    }
  }, [open, account])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await api.post('/azure/account', {
        ...(account ? { id: account.id } : {}),
        email,
        app_id: appId,
        tenant_id: tenantId,
        password,
        login_password: loginPassword,
        note,
      })
      toast.success(account ? '订阅已保存' : '订阅已添加, 正在后台同步资源')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? '编辑 Azure 订阅' : '添加 Azure 订阅'}</DialogTitle>
          <DialogDescription>填写 Azure AD 应用的凭据, 保存后会自动校验并同步。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="az-email">邮箱</Label>
            <Input id="az-email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="az-app">AppID</Label>
              <div className="flex gap-2">
                <Input id="az-app" value={appId} onChange={(event) => setAppId(event.target.value)} required className="flex-1 font-mono" />
                <CopyButton value={appId} label="AppID" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="az-tenant">Tenant ID</Label>
              <div className="flex gap-2">
                <Input id="az-tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} required className="flex-1 font-mono" />
                <CopyButton value={tenantId} label="Tenant ID" />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="az-secret">App Secret (明文)</Label>
              <Input id="az-secret" value={password} onChange={(event) => setPassword(event.target.value)} required className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="az-login">登录密码</Label>
              <Input id="az-login" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="az-note">备注</Label>
            <Textarea id="az-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? '保存中…' : account ? '保存' : '添加'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.display_name || item.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>地区</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue placeholder="选择地区" /></SelectTrigger>
                <SelectContent>
                  {regions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>镜像</Label>
              <Select value={imageId} onValueChange={setImageId}>
                <SelectTrigger><SelectValue placeholder="选择镜像" /></SelectTrigger>
                <SelectContent>
                  {images.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
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
