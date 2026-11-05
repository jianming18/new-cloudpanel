import { useEffect, useMemo, useState } from 'react'
import { ChartColumn, Copy, Pencil, RefreshCw, Trash2 } from 'lucide-react'
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
import { useDebounced } from '@/hooks/use-debounced'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { maskSecret } from '@/lib/format'
import type { DoAccount, Paged } from '@/lib/types'

export function DoAccountsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DoAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DoAccount | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, loading, error, reload } = useRequest<Paged<DoAccount>>(
    (signal) => api.get<Paged<DoAccount>>('/do/account', { wd, page, limit }, signal),
    [wd, page, limit],
  )

  const items = data?.items ?? []
  const selection = useTableSelection(items, (item) => item.id)

  async function syncAccount(item: DoAccount) {
    try {
      await api.get('/do/account/update', { account_id: item.id })
      toast.success('同步完成')
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '同步失败')
    }
  }

  const columns = useMemo<DataColumn<DoAccount>[]>(
    () => [
      {
        key: 'email',
        label: '邮箱',
        render: (item) => (
          <div className="text-[13px] text-slate-700">{item.email || item.name || '—'}</div>
        ),
      },
      {
        key: 'balance',
        label: '余额',
        render: (item) => (
          <span className="tabular-nums text-[13px]">
            {item.month_to_date_balance ? `$${item.month_to_date_balance}` : '未查询到'}
          </span>
        ),
      },
      {
        key: 'server_count',
        label: '实例数',
        render: (item) => (
          <span className="tabular-nums text-[13px]">
            {item.server_count} / {item.droplet_limit}
          </span>
        ),
      },
      {
        key: 'token',
        label: 'Token',
        render: (item) => <span className="font-mono text-xs text-slate-400">{maskSecret(item.token)}</span>,
      },
      {
        key: 'note',
        label: '备注',
        render: (item) => <span className="text-[13px] text-slate-500">{item.note || '—'}</span>,
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
        title="DigitalOcean 账号管理"
        icon={ChartColumn}
        actions={
          <>
            <AccountImportExport
              fields={[
                { name: 'token', label: 'Token', required: true },
                { name: 'name', label: '名称' },
                { name: 'note', label: '备注' },
              ]}
              accounts={items as unknown as Record<string, unknown>[]}
              onImport={async (record) => {
                await api.post('/do/account', {
                  token: record.token ?? '',
                  name: record.name ?? '',
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
          <Toolbar value={keyword} onChange={(value) => { setKeyword(value); setPage(1) }} placeholder="搜索邮箱 / Token">
              <BulkDeleteButton count={selection.selected.length} onDelete={() => setBulkDeleteOpen(true)} />
            </Toolbar>

          {loading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
          ) : items.length === 0 ? (
            <EmptyState title="暂无账号" description="需要 DigitalOcean 个人访问令牌 (Read/Write)" />
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
                    <div className="text-[11px] text-slate-400">API Token (明文)</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.token}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">UUID</div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.uuid || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">实例 / 额度</div>
                    <div className="mt-0.5 text-[13px] font-medium text-slate-700">{item.server_count} / {item.droplet_limit}</div>
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

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="批量删除账号"
        description={`将删除选中的 ${selection.selected.length} 个账号, 该操作不可恢复。`}
        confirmText="确认删除"
        onConfirm={async () => {
          for (const id of selection.selected) {
            try {
              await api.delete('/do/account', { account_id: id })
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
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="复制 Token"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(target?.token ?? '')
                    toast.success('Token 已复制')
                  } catch {
                    toast.error('复制失败, 请手动选择复制')
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
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
