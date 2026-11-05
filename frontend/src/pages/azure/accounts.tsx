import { useEffect, useMemo, useState } from 'react'
import { ChartColumn, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AccountImportExport, BulkDeleteButton } from '@/components/account-import-export'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type DataColumn } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { PagePanel } from '@/components/page-panel'
import { Pagination } from '@/components/pagination'
import { ActionButton, RowActionButtons } from '@/components/row-actions'
import { useTableSelection } from '@/components/table-selection'
import { Toolbar } from '@/components/toolbar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { maskSecret } from '@/lib/format'
import type { AzureAccount, AzureAccountListData } from '@/lib/types'

export function AzureAccountsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AzureAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AzureAccount | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, loading, error, reload } = useRequest<AzureAccountListData>(
    (signal) => api.get<AzureAccountListData>('/azure/account', { wd, page, limit }, signal),
    [wd, page, limit],
  )

  const items = data?.items ?? []
  const selection = useTableSelection(items, (item) => item.id)

  async function syncAccount(item: AzureAccount) {
    try {
      await api.post('/azure/account/action', { account_id: item.id, action: 'update' })
      toast.success('已提交同步')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '同步失败')
    }
  }

  const columns = useMemo<DataColumn<AzureAccount>[]>(
    () => [
      {
        key: 'display_name',
        label: '订阅',
        render: (item) => (
          <div className="text-[13px] text-slate-700">{item.display_name || item.email || '—'}</div>
        ),
      },
      {
        key: 'email',
        label: '邮箱',
        render: (item) => <span className="text-[13px] text-slate-500">{item.email || '—'}</span>,
      },
      {
        key: 'client_id',
        label: 'AppID',
        render: (item) => <span className="font-mono text-xs text-slate-500">{maskSecret(item.client_id)}</span>,
      },
      {
        key: 'vm_count',
        label: '实例数',
        render: (item) => <span className="tabular-nums text-[13px]">{item.vm_count}</span>,
      },
      {
        key: 'note',
        label: '备注',
        render: (item) => <span className="text-[13px] text-slate-500">{item.note || '—'}</span>,
      },
      {
        key: 'status',
        label: '状态',
        render: (item) => <span className="text-[13px] text-slate-600">{item.status_text || item.status}</span>,
      },
      {
        key: 'actions',
        label: 'ACTIONS',
        render: (item) => (
          <RowActionButtons>
            <ActionButton icon={RefreshCw} title="同步" onClick={() => syncAccount(item)} />
            <ActionButton icon={Pencil} title="编辑" onClick={() => setEditTarget(item)} />
            <ActionButton icon={Trash2} title="删除" destructive onClick={() => setDeleteTarget(item)} />
          </RowActionButtons>
        ),
      },
    ],
    [],
  )

  return (
    <>
      <PagePanel
        title="Azure 账号管理"
        icon={ChartColumn}
        actions={
          <>
            <AccountImportExport
              fields={[
                { name: 'email', label: '邮箱', required: true },
                { name: 'app_id', label: 'AppID', required: true },
                { name: 'tenant_id', label: 'Tenant ID', required: true },
                { name: 'password', label: 'App Secret', required: true },
                { name: 'login_password', label: '登录密码' },
                { name: 'note', label: '备注' },
              ]}
              accounts={items as unknown as Record<string, unknown>[]}
              onImport={async (record) => {
                await api.post('/azure/account', {
                  email: record.email ?? '',
                  app_id: record.app_id ?? '',
                  tenant_id: record.tenant_id ?? '',
                  password: record.password ?? '',
                  login_password: record.login_password ?? '',
                  note: record.note ?? '',
                })
              }}
            />
            <Button onClick={() => setCreateOpen(true)}>
              <span className="text-base leading-none">+</span>
              添加
            </Button>
          </>
        }
      >
        <div>
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索订阅 / 邮箱 / AppID">
              <BulkDeleteButton count={selection.selected.length} onDelete={() => setBulkDeleteOpen(true)} />
            </Toolbar>

          {loading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
          ) : items.length === 0 ? (
            <EmptyState title="暂无订阅" description="需要 Azure AD 应用的 AppID / Secret / Tenant" />
          ) : (
            <DataTable
              columns={columns}
              items={items}
              rowKey={(item) => item.id}
              selectable
              selection={selection}
              selectionId={(item) => item.id}
              expandable
              expandedId={expandedId}
              onToggleExpand={(item) => setExpandedId((prev) => (prev === item.id ? null : item.id))}
              renderExpanded={(item) => (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">App ID</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.client_id || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">Tenant ID</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.tenant_id || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">App Secret (明文)</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.password || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">登录密码</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.login_password || '—'}</div>
                  </div>
                </div>
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

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="批量删除订阅"
        description={`将删除选中的 ${selection.selected.length} 个订阅, 该操作不可恢复。`}
        confirmText="确认删除"
        onConfirm={async () => {
          for (const id of selection.selected) {
            try {
              await api.post('/azure/account/delete', { account_id: id })
            } catch {
              // 单条失败不中断整批删除
            }
          }
          selection.clear()
          toast.success('批量删除完成')
          reload()
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
              <Input id="az-app" value={appId} onChange={(event) => setAppId(event.target.value)} required className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="az-tenant">Tenant ID</Label>
              <Input id="az-tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} required className="font-mono" />
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
