import { useEffect, useState } from 'react'
import { Cloud, Loader2, LockKeyhole, UserRound } from 'lucide-react'
import { useLocation } from 'wouter'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'

export function LoginPage() {
  const { user, login } = useAuth()
  const [, navigate] = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await login(username.trim(), password)
      toast.success('登录成功')
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '登录失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-background to-sky-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cloud className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">CloudPanel</h1>
          <p className="text-sm text-muted-foreground">多云资源管理控制台</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="username">账号</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                autoComplete="username"
                className="pl-8"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入账号"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="pl-8"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? '登录中…' : '登录'}
          </Button>
        </form>
      </div>
    </div>
  )
}
