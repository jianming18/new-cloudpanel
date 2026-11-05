import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface AccountOption {
  id: number
  name: string
  /** 账号备注, 存在时以下拉项内括号展示 */
  note?: string
  /** 下拉项右侧的补充信息, 例如余额 */
  meta?: string
}

/** 'all' 表示不按账号过滤 */
export const ALL_ACCOUNTS = 'all'

/**
 * 账号筛选项与地址栏同步:
 * 刷新后仍保持筛选, 也方便从账号页带 ?account_id= 直接跳过来
 */
export function useAccountFilter() {
  const [accountId, setAccountIdState] = useState<string>(
    () => new URLSearchParams(window.location.search).get('account_id') || ALL_ACCOUNTS,
  )

  const setAccountId = useCallback((value: string) => {
    setAccountIdState(value)
    const url = new URL(window.location.href)
    if (value === ALL_ACCOUNTS) url.searchParams.delete('account_id')
    else url.searchParams.set('account_id', value)
    window.history.replaceState({}, '', url)
  }, [])

  return [accountId, setAccountId] as const
}

interface AccountFilterProps {
  value: string
  onChange: (value: string) => void
  accounts: AccountOption[]
  className?: string
}

export function AccountFilter({ value, onChange, accounts, className }: AccountFilterProps) {
  // 下拉框只列出具体账号, 不再提供"全部账号"; 账号加载后若当前值无效(含初始的 all)则自动选中第一个
  useEffect(() => {
    if (accounts.length === 0) return
    if (accounts.some((account) => String(account.id) === value)) return
    onChange(String(accounts[0].id))
  }, [accounts, value, onChange])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('h-10 w-full sm:w-[300px]', className)}>
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="选择账号" className="truncate" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={String(account.id)} title={account.note || undefined}>
            <span className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate">
                {account.note ? `${account.name}（${account.note}）` : account.name}
              </span>
              {account.meta ? <span className="shrink-0 text-xs text-slate-400">{account.meta}</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
