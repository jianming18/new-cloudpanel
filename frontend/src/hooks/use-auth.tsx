import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, clearToken, getToken, setToken } from '@/lib/api'
import type { LoginResult, UserInfo } from '@/lib/types'

interface AuthContextValue {
  user: UserInfo | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setReady(true)
      return
    }
    try {
      const info = await api.get<UserInfo>('/passport/info')
      setUser(info)
    } catch {
      // token 失效时 api 层已经清理并跳转, 这里只需要清空本地状态
      setUser(null)
      clearToken()
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.post<LoginResult>('/passport/login', { username, password })
    setToken(result.token)
    const info = await api.get<UserInfo>('/passport/info')
    setUser(info)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/passport/logout')
    } catch {
      // 忽略退出接口异常, 本地照样清登录态
    }
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, ready, login, logout, refresh }), [user, ready, login, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
