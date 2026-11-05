import { useMemo, useState } from 'react'
import { ChartColumn, Gauge, Pencil, RefreshCw, Trash2 } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { maskSecret } from '@/lib/format'
import type { AwsAccount, Paged } from '@/lib/types'

interface QuotaItem {
  0: string
  1: string
  2: number | boolean
}

export function AwsAccountsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [editing, setEditing] = useState<AwsAccount | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AwsAccount | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [quotaTarget, setQuotaTarget] = useState<AwsAccount | null>(null)
  const [quota, setQuota] = useState<QuotaItem[]>([])
  const [quotaLoading, setQuotaLoading] = useState(false)

  const { data, loading, error, reload } = useRequest<Paged<AwsAccount>>(
    (signal) => api.get<Paged<AwsAccount>>('/aws/account', { page, limit, wd }, signal),
    [page, limit, wd],
  )

  const items = data?.items ?? []
  const selection = useTableSelection(items, (item) => item.id)

  async function syncAccount(item: AwsAccount) {
    try {
      await api.get('/aws/account/update', { account_id: item.id })
      toast.success('已提交后台同步, 稍后刷新查看')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '同步失败')
    }
  }

  async function openQuota(item: AwsAccount) {
    setQuotaTarget(item)
    setQuota([])
    setQuotaLoading(true)
    try {
      const result = await api.get<{ items: QuotaItem[] }>('/aws/account/get_quota', { account_id: item.id })
      setQuota(result.items || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '获取额度失败')
    } finally {
      setQuotaLoading(false)
    }
  }

  const columns = useMemo<DataColumn<AwsAccount>[]>(
    () => [
      {
        key: 'name',
        label: '账号',
        render: (item) => (
          <div className="text-[13px] text-slate-700">{item.name || item.email || '—'}</div>
        ),
      },
      {
        key: 'key_id',
        label: 'Access Key',
        render: (item) => <span className="font-mono text-xs text-slate-500">{maskSecret(item.key_id)}</span>,
      },
      {
        key: 'quota',
        label: '配额',
        render: (item) => <span className="tabular-nums text-[13px]">{item.value || '—'}</span>,
      },
      {
        key: 'note',
        label: '备注',
        render: (item) => <span className="text-[13px] text-slate-500">{item.note || '—'}</span>,
      },
      {
        key: 'status',
        label: '状态',
        render: (item) => <span className="text-[13px] text-slate-600">{item.status ? '可用' : '异常'}</span>,
      },
      {
        key: 'actions',
        label: 'ACTIONS',
        render: (item) => (
          <RowActionButtons>
            <ActionButton icon={RefreshCw} title="同步资源" onClick={() => syncAccount(item)} />
            <ActionButton icon={Gauge} title="查看配额" onClick={() => openQuota(item)} />
            <ActionButton icon={Pencil} title="编辑" onClick={() => setEditing(item)} />
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
        title="AWS 账号管理"
        icon={ChartColumn}
        actions={
          <>
            <AccountImportExport
              fields={[
                { name: 'name', label: '名称' },
                { name: 'email', label: '邮箱', required: true },
                { name: 'key_id', label: 'Access Key', required: true },
                { name: 'secret', label: 'Secret', required: true },
                { name: 'note', label: '备注' },
              ]}
              accounts={items as unknown as Record<string, unknown>[]}
              onImport={async (record) => {
                await api.post('/aws/account', {
                  name: record.name ?? '',
                  email: record.email ?? '',
                  key_id: record.key_id ?? '',
                  secret: record.secret ?? '',
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
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索名称 / 邮箱 / Key">
              <BulkDeleteButton count={selection.selected.length} onDelete={() => setBulkDeleteOpen(true)} />
            </Toolbar>

          {loading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
          ) : items.length === 0 ? (
            <EmptyState title="还没有 AWS 账号" description="添加 Access Key 后才能创建实例" action={<Button onClick={() => setCreateOpen(true)}>添加账号</Button>} />
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
                    <div className="text-[11px] text-slate-400">Access Key ID</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.key_id || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">Secret Access Key</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.secret ? '••••••••••••' : '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">邮箱</div>
                    <div className="mt-0.5 truncate text-[13px] font-medium text-slate-700">{item.email || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">备注</div>
                    <div className="mt-0.5 truncate text-[13px] font-medium text-slate-700">{item.note || '—'}</div>
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

      <AccountDialog
        open={createOpen || Boolean(editing)}
        account={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        onSaved={reload}
      />

      <Dialog open={Boolean(quotaTarget)} onOpenChange={(open) => !open && setQuotaTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>实例配额</DialogTitle>
            <DialogDescription>{quotaTarget?.name} · 各地区可开通的 EC2 数量</DialogDescription>
          </DialogHeader>
          {quotaLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : quota.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无配额数据</p>
          ) : (
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>地区</TableHead>
                    <TableHead className="text-right">配额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quota.map((row) => (
                    <TableRow key={String(row[0])}>
                      <TableCell className="text-left">{row[1]}</TableCell>
                      <TableCell className="text-right tabular-nums">{String(row[2])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="删除 AWS 账号"
        description={deleteTarget ? `将删除账号 ${deleteTarget.name || deleteTarget.email} 及其关联实例记录。` : ''}
        confirmText="确认删除"
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await api.post('/aws/account/delete', { account_id: deleteTarget.id })
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
        title="批量删除账号"
        description={`将删除选中的 ${selection.selected.length} 个账号, 该操作不可恢复。`}
        confirmText="确认删除"
        onConfirm={async () => {
          for (const id of selection.selected) {
            try {
              await api.post('/aws/account/delete', { account_id: id })
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

function AccountDialog({
  open,
  account,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  account: AwsAccount | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)

  // 打开时用当前账号回填
  const editingId = account?.id ?? null
  const [loadedId, setLoadedId] = useState<number | null>(null)
  if (open && editingId !== loadedId) {
    setLoadedId(editingId)
    setName(account?.name ?? '')
    setEmail(account?.email ?? '')
    setKey(account?.key_id ?? '')
    setSecret('')
    setNote(account?.note ?? '')
  }
  if (!open && loadedId !== null) {
    setLoadedId(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!account && !secret) {
      toast.error('请填写 Secret')
      return
    }
    setPending(true)
    try {
      await api.post('/aws/account', {
        ...(account ? { id: account.id } : {}),
        name,
        email,
        key,
        secret,
        note,
      })
      toast.success(account ? '已保存' : '账号已添加')
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
          <DialogTitle>{account ? '编辑 AWS 账号' : '添加 AWS 账号'}</DialogTitle>
          <DialogDescription>Access Key 需要具备 EC2 / Lightsail 操作权限。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">名称</Label>
              <Input id="acc-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-email">邮箱</Label>
              <Input id="acc-email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-key">Access Key ID</Label>
            <Input id="acc-key" value={key} onChange={(event) => setKey(event.target.value)} required className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-secret">Secret Access Key</Label>
            <Input
              id="acc-secret"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              required={!account}
              className="font-mono"
              placeholder={account ? '留空则不修改' : ''}
            />
            {account ? <p className="text-xs text-muted-foreground">出于安全考虑不回显原密钥, 留空表示保持不变。</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-note">备注</Label>
            <Textarea id="acc-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
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
