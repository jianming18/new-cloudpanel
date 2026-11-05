import { CloudOff } from 'lucide-react'
import { Link } from 'wouter'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CloudOff className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">页面不存在</h2>
        <p className="text-sm text-muted-foreground">你访问的地址可能已被移除或输入有误。</p>
      </div>
      <Button asChild>
        <Link href="/">返回仪表盘</Link>
      </Button>
    </div>
  )
}
