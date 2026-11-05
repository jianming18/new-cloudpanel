import { useCallback, useState } from 'react'
import { Users } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface AccountOption {
  id: number
  name: string
  /** 账号备注, 存在时以下拉项内括号展示 */
  note?: string
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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('h-9 w-full sm:w-[200px]', className)}>
        <span className="flex items-center gap-2 truncate">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="全部账号" />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_ACCOUNTS}>全部账号</SelectItem>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={String(account.id)} title={account.note || undefined}>
            {account.note ? `${account.name}（${account.note}）` : account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
