import { useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

async function copyText(text: string, label: string) {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      ta.setSelectionRange(0, text.length)
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      if (!ok) throw new Error('execCommand failed')
    }
    toast.success(`${label}已复制`)
  } catch {
    toast.error(`${label}复制失败, 请手动选择复制`)
  }
}

export interface InstanceLoginInfo {
  ip?: string
  username?: string
  password?: string
  port?: string
}

interface InstanceDetailProps {
  info: InstanceLoginInfo
  /** 补充信息, 例如账号归属 / 创建时间 */
  extra?: { label: string; value: string }[]
}

/** 展开行里的登录信息: IP / 用户 / 端口 / 密码, 均可复制 */
export function InstanceDetail({ info, extra }: InstanceDetailProps) {
  const username = info.username || 'root'
  const port = info.port || '22'
  const password = info.password || ''

  const fields = [
    { label: '公网 IP', value: info.ip || '—', copyable: Boolean(info.ip) },
    { label: '登录用户', value: username, copyable: true },
    { label: 'SSH 端口', value: port, copyable: true },
  ]

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] text-slate-400">{field.label}</div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[13px] font-medium text-slate-700">{field.value}</span>
              {field.copyable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-slate-400 hover:text-primary"
                  title={`复制${field.label}`}
                  onClick={() => copyText(field.value, field.label)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="text-[11px] text-slate-400">密码</div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[13px] font-medium text-slate-700">
              <PasswordField value={password} />
            </span>
            {password ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-slate-400 hover:text-primary"
                title="复制密码"
                onClick={() => copyText(password, '密码')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {extra?.length ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          {extra.map((item) => (
            <span key={item.label}>
              {item.label}: <span className="font-medium text-slate-700">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        SSH 登录: <span className="font-mono text-slate-600">ssh -p {port} {username}@{info.ip || 'IP'}</span>
      </p>
    </div>
  )
}

function PasswordField({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false)

  if (!value) return <span className="text-slate-400">未记录</span>

  return (
    <span className="inline-flex items-center gap-1">
      <span>{revealed ? value : '••••••••'}</span>
      <button
        type="button"
        title={revealed ? '隐藏密码' : '显示密码'}
        onClick={() => setRevealed((prev) => !prev)}
        className="text-slate-400 transition-colors hover:text-primary"
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}
