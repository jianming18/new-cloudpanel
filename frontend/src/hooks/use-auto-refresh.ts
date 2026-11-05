import { useCallback, useEffect, useRef, useState } from 'react'

interface AutoRefreshOptions {
  /** 是否开启轮询 */
  active: boolean
  /** 轮询间隔(毫秒), 默认 6 秒 */
  interval?: number
}

/**
 * 页面可见时才轮询, 切到后台自动暂停, 避免无意义请求
 */
export function useAutoRefresh(reload: () => void, { active, interval = 6000 }: AutoRefreshOptions) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload

  useEffect(() => {
    if (!active) return

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reloadRef.current()
    }, interval)

    return () => window.clearInterval(timer)
  }, [active, interval])
}

/**
 * 创建实例后开启一段时间的自动刷新窗口:
 * 新实例通常要几秒(甚至几分钟)才同步进列表, 这段时间内保持轮询
 */
export function useWatchWindow(duration = 120_000) {
  const [watching, setWatching] = useState(false)
  const [token, setToken] = useState(0)

  const start = useCallback(() => {
    setWatching(true)
    setToken((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!watching) return
    const timer = window.setTimeout(() => setWatching(false), duration)
    return () => window.clearTimeout(timer)
  }, [watching, token, duration])

  return [watching, start] as const
}
