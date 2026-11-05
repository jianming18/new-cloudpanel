const TOKEN_KEY = 'cloudpanel.token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

type Envelope<T> = {
  code: number
  message?: string
  data?: T
  error_data?: Record<string, string[]>
  error_message?: string
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, unknown>
  body?: Record<string, unknown>
  signal?: AbortSignal
}

/**
 * 后端统一返回 { code, message, data }, 业务成功固定为 20000。
 * POST/PUT 一律用 form-urlencoded —— Django 视图读的是 request.POST, 传 JSON 会拿不到值。
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', params, body, signal } = options

  let url = `/api${path}`
  if (params) {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      search.append(key, String(value))
    })
    const query = search.toString()
    if (query) url += `?${query}`
  }

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['X-Token'] = token

  let payload: string | undefined
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const form = new URLSearchParams()
    Object.entries(body).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
    })
    payload = form.toString()
  }

  const response = await fetch(url, { method, headers, body: payload, signal, credentials: 'same-origin' })

  let json: Envelope<T>
  try {
    json = (await response.json()) as Envelope<T>
  } catch {
    throw new ApiError(response.status, `服务异常 (${response.status})`)
  }

  // 登录态失效: 清掉本地 token 并回到登录页
  if (json.code === 50008) {
    clearToken()
    if (window.location.pathname !== '/login') window.location.href = '/login'
    throw new ApiError(json.code, json.message || '登录已失效, 请重新登录')
  }

  if (!response.ok) {
    throw new ApiError(response.status, json.message || `请求失败 (${response.status})`)
  }

  if (json.code !== 20000) {
    const firstFieldError = json.error_data ? Object.values(json.error_data)[0]?.[0] : undefined
    throw new ApiError(json.code, firstFieldError || json.error_message || json.message || '操作失败')
  }

  return (json.data ?? ({} as T)) as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', params, signal }),
  post: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: Record<string, unknown>) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, params?: Record<string, unknown>) => request<T>(path, { method: 'DELETE', params }),
}
