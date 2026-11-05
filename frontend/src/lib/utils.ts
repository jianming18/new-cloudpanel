import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const NAME_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_'

/** 生成 16 位随机实例名称, 如 iqIY8_XZ2gpTx85q */
export function randomName(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => NAME_CHARSET[b % NAME_CHARSET.length]).join('')
}

// 去掉易混淆字符 (0O1lI) 的密码字符集
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASSWORD_LOWER = 'abcdefghjkmnpqrstuvwxyz'
const PASSWORD_DIGIT = '23456789'
const PASSWORD_SYMBOL = '!@#$%^&*-_=+'
const PASSWORD_CHARSET = PASSWORD_UPPER + PASSWORD_LOWER + PASSWORD_DIGIT + PASSWORD_SYMBOL

/** 生成随机 root 密码: 保证同时包含大写/小写/数字/特殊字符, 满足各云厂商复杂度要求 */
export function randomPassword(length = 16): string {
  if (length < 4) length = 4
  const bytes = new Uint8Array(length * 2)
  crypto.getRandomValues(bytes)
  const sets = [PASSWORD_UPPER, PASSWORD_LOWER, PASSWORD_DIGIT, PASSWORD_SYMBOL]
  const chars: string[] = []
  // 前四个字符保证四类字符各出现一次
  sets.forEach((set, index) => chars.push(set[bytes[index] % set.length]))
  for (let i = 4; i < length; i++) chars.push(PASSWORD_CHARSET[bytes[i] % PASSWORD_CHARSET.length])
  // Fisher-Yates 打乱
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[length + i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
