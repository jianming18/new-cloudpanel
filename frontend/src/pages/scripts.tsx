import { useState } from 'react'
import { FileCode2, Plus, SquarePen } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { DataTable } from '@/components/data-table'
import { PagePanel } from '@/components/page-panel'
import { Pagination } from '@/components/pagination'
import { ActionButton, RowActionButtons } from '@/components/row-actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useRequest } from '@/hooks/use-request'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { Paged, ScriptItem } from '@/lib/types'

export function ScriptsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [editing, setEditing] = useState<ScriptItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, loading, error, reload } = useRequest<Paged<ScriptItem>>(
    (signal) => api.get<Paged<ScriptItem>>('/passport/scripts', { page, limit }, signal),
    [page, limit],
  )

  const items = data?.items ?? []

  return (
    <>
      <PagePanel
        title="启动脚本"
        description="创建实例时可选择脚本, 内容会在首次开机时以 root 执行"
        icon={FileCode2}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建脚本</Button>}
      >
        <div>
        {loading ? (
          <div className="space-y-2 px-6 py-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <EmptyState title="加载失败" description={error} action={<Button variant="outline" onClick={reload}>重试</Button>} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileCode2}
            title="还没有脚本"
            description="把常用的初始化命令存成脚本, 建机器时直接选用"
            action={<Button onClick={() => setCreateOpen(true)}>新建脚本</Button>}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                label: '名称',
                render: (item) => <span className="font-medium">{item.name}</span>,
              },
              {
                key: 'content',
                label: '内容预览',
                render: (item) => (
                  <span className="block max-w-[520px] truncate font-mono text-xs text-muted-foreground">
                    {item.content.replace(/\s+/g, ' ').slice(0, 120) || '—'}
                  </span>
                ),
                cellClassName: 'text-left',
              },
              {
                key: 'update_time',
                label: '更新时间',
                render: (item) => <span className="text-muted-foreground">{formatDate(item.update_time)}</span>,
              },
              {
                key: 'actions',
                label: '操作',
                render: (item) => (
                  <RowActionButtons>
                    <ActionButton icon={SquarePen} title="编辑" onClick={() => setEditing(item)} />
                  </RowActionButtons>
                ),
              },
            ]}
            items={items}
            rowKey={(item) => item.id}
          />
        )}

        <Pagination page={page} limit={limit} total={data?.total ?? 0} onPageChange={setPage} onLimitChange={(value) => { setLimit(value); setPage(1) }} />
        </div>
      </PagePanel>

      <ScriptDialog
        open={createOpen || Boolean(editing)}
        script={editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditing(null)
          }
        }}
        onSaved={reload}
      />
    </>
  )
}

function ScriptDialog({
  open,
  script,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  script: ScriptItem | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [pending, setPending] = useState(false)
  const [loadedId, setLoadedId] = useState<number | null>(null)

  const currentId = script?.id ?? null
  if (open && currentId !== loadedId) {
    setLoadedId(currentId)
    setName(script?.name ?? '')
    setContent(script?.content ?? '')
  }
  if (!open && loadedId !== null) setLoadedId(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await api.post('/passport/scripts', {
        ...(script ? { script_id: script.id } : {}),
        name,
        content,
      })
      toast.success(script ? '已保存' : '脚本已创建')
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{script ? '编辑脚本' : '新建脚本'}</DialogTitle>
          <DialogDescription>脚本以 shell 形式在实例首次启动时执行, 请自行确保幂等。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="script-name">名称</Label>
            <Input id="script-name" value={name} onChange={(event) => setName(event.target.value)} required placeholder="install-nginx" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="script-content">脚本内容</Label>
            <Textarea
              id="script-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={14}
              required
              className="font-mono text-xs"
              placeholder={'#!/bin/bash\napt-get update && apt-get install -y nginx'}
            />
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
