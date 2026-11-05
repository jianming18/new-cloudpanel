import { useCallback, useEffect, useRef, useState } from 'react'

interface RequestState<T> {
  data: T | null
  loading: boolean
  refreshing: boolean
  error: string | null
}

/**
 * 极简的数据请求 hook:
 * - deps 变化时自动重取
 * - 卸载/重取时取消上一个请求, 避免竞态
 * - reload() 手动/轮询刷新; 已有数据时不会把列表打回骨架屏 (refreshing 单独标记)
 */
export function useRequest<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<RequestState<T>>({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
  })
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    const controller = new AbortController()
    let alive = true

    // 首次加载显示骨架屏, 后续静默刷新保留旧数据
    setState((prev) => ({
      ...prev,
      loading: prev.data === null,
      refreshing: prev.data !== null,
      error: null,
    }))

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!alive) return
        setState({ data, loading: false, refreshing: false, error: null })
      })
      .catch((error: unknown) => {
        if (!alive || controller.signal.aborted) return
        const message = error instanceof Error ? error.message : '加载失败'
        setState((prev) => ({ data: prev.data, loading: false, refreshing: false, error: message }))
      })

    return () => {
      alive = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  return { ...state, reload }
}
