import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface CredentialInfo {
  /** 实例名称, 用作弹窗标题 */
  title: string
  /** 副标题, 例如实例 ID */
  description?: string
  ip?: string
  username?: string
  password?: string
  port?: string
}

async function copyText(text: string, label: string) {
  // HTTPS 环境优先用异步剪贴板 API
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label}已复制`)
      return
    } catch {
      // 降级到下面的方案
    }
  }
  // 非 HTTPS (如 http://IP:8086) 下 navigator.clipboard 不可用, 用隐藏文本框 + execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.border = 'none'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) {
      toast.success(`${label}已复制`)
      return
    }
    throw new Error('execCommand returned false')
  } catch {
    toast.error(`${label}复制失败, 请手动选择复制`)
  }
}

/** 通用复制按钮 */
export function CopyButton({ value, label = '内容', className }: { value: string; label?: string; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8 shrink-0', className)}
      title={`复制${label}`}
      onClick={() => copyText(value, label)}
    >
      <Copy className="h-4 w-4" />
    </Button>
  )
}

/** 登录信息行: 左侧标签, 右侧值 + 复制按钮 */
function InfoRow({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn('truncate text-sm font-medium', mono && 'font-mono')}>{value}</div>
      </div>
      {copyable && <CopyButton value={value} label={label} />}
    </div>
  )
}

/**
 * 实例登录信息弹窗: 展示公网 IP / 登录用户 / 端口 / 密码
 * 各云厂商实例列表点击行后调用
 */
export function CredentialsDialog({
  open,
  onOpenChange,
  info,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  info: CredentialInfo | null
}) {
  const [revealed, setRevealed] = useState(false)

  // 每次打开都恢复密码隐藏状态
  useEffect(() => {
    if (open) setRevealed(false)
  }, [open])

  if (!info) return null

  const password = info.password || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>登录信息 - {info.title}</DialogTitle>
          {info.description && <DialogDescription>{info.description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2.5">
          <InfoRow label="公网 IP" value={info.ip || '—'} mono copyable={Boolean(info.ip)} />
          <InfoRow label="登录用户" value={info.username || 'root'} copyable />
          <InfoRow label="端口 (SSH)" value={info.port || '22'} copyable />

          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">密码</div>
              {password ? (
                <div className="truncate font-mono text-sm font-medium">
                  {revealed ? password : '••••••••••••'}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">未记录 (实例可能不是通过本面板创建)</div>
              )}
            </div>
            {password && (
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" title={revealed ? '隐藏密码' : '显示密码'} onClick={() => setRevealed((value) => !value)}>
                  {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="复制密码" onClick={() => copyText(password, '密码')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          SSH 登录: <span className="font-mono">ssh -p {info.port || '22'} {info.username || 'root'}@{info.ip || 'IP'}</span>
        </p>
      </DialogContent>
    </Dialog>
  )
}
