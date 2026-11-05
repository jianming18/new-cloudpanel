import { useEffect, useMemo, useState } from 'react'
import { ChartColumn, Copy, HeartPulse, KeyRound, Pencil, Trash2 } from 'lucide-react'
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
import type { LinodeAccount, LinodeAccountListData } from '@/lib/types'

export function LinodeAccountsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [keyword, setKeyword] = useState('')
  const wd = useDebounced(keyword)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LinodeAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LinodeAccount | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, loading, error, reload } = useRequest<LinodeAccountListData>(
    (signal) => api.get<LinodeAccountListData>('/linode/account', { wd, page, limit }, signal),
    [wd, page, limit],
  )

  const items = data?.items ?? []
  const selection = useTableSelection(items, (item) => item.id)

  async function checkBalance(item: LinodeAccount) {
    try {
      await api.get('/linode/account/update', { account_id: item.id })
      toast.success(`${item.email || item.name} 余额已刷新`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '检测失败')
    }
  }

  async function checkAllBalances() {
    if (selection.selected.length === 0) return
    setChecking(true)
    for (const id of selection.selected) {
      const item = items.find((row) => row.id === id)
      if (!item) continue
      try {
        await api.get('/linode/account/update', { account_id: item.id })
      } catch {
        // 单个账号失败不中断整批, 结束后统一提示
      }
    }
    setChecking(false)
    toast.success(`已刷新 ${selection.selected.length} 个账号的余额`)
    reload()
  }

  const columns = useMemo<DataColumn<LinodeAccount>[]>(
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
          <span className="tabular-nums text-[13px]">{item.balance ? `$${item.balance}` : '未查询到'}</span>
        ),
      },
      {
        key: 'count',
        label: '实例数',
        render: (item) => <span className="tabular-nums text-[13px]">{item.count}</span>,
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
        key: 'actions',
        label: 'ACTIONS',
        render: (item) => (
          <RowActionButtons>
            <ActionButton icon={Pencil} title="编辑" onClick={() => setEditTarget(item)} />
            <ActionButton icon={HeartPulse} title="检测余额" onClick={() => checkBalance(item)} />
            <ActionButton icon={KeyRound} title="查看 Token" onClick={() => setEditTarget(item)} />
            <ActionButton icon={Trash2} title="删除" destructive onClick={() => setDeleteTarget(item)} />
          </RowActionButtons>
        ),
      },
    ],
    [items],
  )

  return (
    <>
      <PagePanel
        title="Linode 账号管理"
        icon={ChartColumn}
        actions={
          <>
            <AccountImportExport
              fields={[
                { name: 'token', label: 'Token', required: true, hint: '64 位十六进制' },
                { name: 'name', label: '名称' },
                { name: 'note', label: '备注' },
              ]}
              accounts={items as unknown as Record<string, unknown>[]}
              onImport={async (record) => {
                await api.post('/linode/account', {
                  token: record.token,
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
              <Button
                variant="outline"
                disabled={selection.selected.length === 0 || checking}
                onClick={checkAllBalances}
                className="border-slate-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
              >
                <HeartPulse className="h-4 w-4" />
                批量检测余额
              </Button>
              <BulkDeleteButton count={selection.selected.length} onDelete={() => setBulkDeleteOpen(true)} />
            </Toolbar>

          {loading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
          ) : items.length === 0 ? (
            <EmptyState title="暂无账号" description="需要 Linode Personal Access Token (Read/Write)" />
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
                    <div className="mt-0.5 truncate font-mono text-[13px] font-medium text-slate-700">{item.euuid || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-slate-400">实例数</div>
                    <div className="mt-0.5 text-[13px] font-medium text-slate-700">{item.count}</div>
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

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="批量删除账号"
        description={`将删除选中的 ${selection.selected.length} 个账号, 该操作不可恢复。`}
        confirmText="确认删除"
        onConfirm={async () => {
          for (const id of selection.selected) {
            try {
              await api.post('/linode/account/delete', { account_id: id })
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
              <CopyTokenButton value={target?.token ?? ''} />
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

function CopyTokenButton({ value }: { value: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title="复制 Token"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast.success('Token 已复制')
        } catch {
          toast.error('复制失败, 请手动选择复制')
        }
      }}
    >
      <Copy className="h-4 w-4" />
    </Button>
  )
}