export type Tone = 'success' | 'warning' | 'muted' | 'danger' | 'info'

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

/** 把各云厂商不同的状态字符串归一成 4 种颜色语义 */
export function statusTone(status?: string | null): Tone {
  const value = (status || '').toLowerCase()

  if (!value) return 'muted'
  if (['running', 'active', 'enabled', 'deployed', 'available'].includes(value)) return 'success'
  if (['pending', 'starting', 'stopping', 'creating', 'rebooting', 'in_progress', 'warned'].includes(value)) {
    return 'warning'
  }
  if (['stopped', 'off', 'offline', 'disabled', 'shutting-down', 'terminated', 'deleted'].includes(value)) {
    return 'muted'
  }
  if (['error', 'failed', 'unhealthy'].includes(value)) return 'danger'
  return 'info'
}

/** 过渡态: 这些状态说明实例还在变更中, 需要轮询刷新 */
export function isTransient(status?: string | null): boolean {
  const value = (status || '').toLowerCase()
  return [
    'pending',
    'starting',
    'stopping',
    'creating',
    'rebooting',
    'shutting-down',
    'in_progress',
    'deleting',
    'deploying',
  ].includes(value)
}

export function statusLabel(status?: string | null, fallback?: string): string {
  if (fallback) return fallback
  if (!status) return '未知'
  const map: Record<string, string> = {
    running: '运行中',
    stopped: '已停止',
    starting: '启动中',
    stopping: '停止中',
    pending: '处理中',
    terminated: '已终止',
    'shutting-down': '关闭中',
    active: '正常',
    inactive: '未启用',
    enabled: '正常',
    disabled: '已停止',
  }
  return map[status.toLowerCase()] || status
}

/** 密钥/Token 统一做遮罩, 只保留首尾各 4 位 */
export function maskSecret(value?: string | null): string {
  if (!value) return '—'
  if (value.length <= 8) return '••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

export function truncate(value: string, max = 28): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}
