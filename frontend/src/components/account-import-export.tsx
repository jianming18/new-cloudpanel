import { useState } from 'react'
import { Download, FileUp, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'

export interface ImportField {
  /** 字段名, 与后端接口参数一致 */
  name: string
  label: string
  /** 必填字段 */
  required?: boolean
  /** 字段说明, 展示在模板里 */
  hint?: string
}

interface AccountImportExportProps {
  /** 导入模板字段, 决定导出结构与导入解析规则 */
  fields: ImportField[]
  /** 当前账号列表, 导出时使用 */
  accounts: Record<string, unknown>[]
  /** 导入提交: 接收一条记录 */
  onImport: (record: Record<string, string>) => Promise<void>
}

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * 账号导入 / 导出:
 * - 导出把当前账号列表写成 CSV, 不含密钥字段
 * - 导入解析 CSV 后逐条提交到已有的「添加账号」接口
 */
export function AccountImportExport({ fields, accounts, onImport }: AccountImportExportProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)

  function handleExport() {
    const headers = fields.map((field) => field.label)
    const rows = accounts.map((account) =>
      fields.map((field) => {
        const value = account[field.name]
        return value === undefined || value === null ? '' : String(value)
      }),
    )
    download(`accounts-${Date.now()}.csv`, toCsv(headers, rows), 'text/csv;charset=utf-8')
    toast.success(`已导出 ${accounts.length} 条账号`)
  }

  function handleTemplate() {
    const headers = fields.map((field) => field.label)
    const sample = fields.map((field) => (field.required ? `${field.label}必填` : ''))
    download('accounts-template.csv', toCsv(headers, [sample]), 'text/csv;charset=utf-8')
    toast.success('模板已下载')
  }

  async function handleImport() {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('#'))

    if (lines.length === 0) {
      toast.error('请填写要导入的账号数据')
      return
    }

    const labels = lines[0].split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
    const headerRow = fields.map((field) => field.label)
    const isHeader = labels.length === headerRow.length && labels.every((cell, index) => cell === headerRow[index])

    const dataRows = isHeader ? lines.slice(1) : lines
    if (dataRows.length === 0) {
      toast.error('模板中还没有数据行')
      return
    }

    setPending(true)
    let success = 0
    const failures: string[] = []

    for (const line of dataRows) {
      const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
      const record: Record<string, string> = {}
      fields.forEach((field, index) => {
        record[field.name] = cells[index] ?? ''
      })

      const missing = fields.find((field) => field.required && !record[field.name])
      if (missing) {
        failures.push(`第 ${dataRows.indexOf(line) + (isHeader ? 2 : 1)} 行缺少 ${missing.label}`)
        continue
      }

      try {
        await onImport(record)
        success += 1
      } catch (error) {
        failures.push(error instanceof Error ? error.message : '导入失败')
      }
    }

    setPending(false)
    if (success > 0) toast.success(`成功导入 ${success} 个账号`)
    if (failures.length > 0) toast.error(`导入失败 ${failures.length} 条: ${failures[0]}`)
    if (success > 0) {
      setImportOpen(false)
      setText('')
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-slate-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700">
            <FileUp className="h-4 w-4" />
            导入账号
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            粘贴 CSV 数据
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTemplate}>
            <Download className="h-4 w-4" />
            下载导入模板
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" className="border-slate-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700" onClick={handleExport}>
        <Download className="h-4 w-4" />
        导出账号
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>导入账号</DialogTitle>
            <DialogDescription>
              每行一个账号, 列顺序: {fields.map((field) => field.label).join(', ')}
              {fields.some((field) => field.required) ? ' (标 * 为必填)' : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={10}
            placeholder={fields.map((field) => field.label).join(',')}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={pending}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={pending}>
              {pending ? '导入中…' : '开始导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface BulkDeleteButtonProps {
  count: number
  onDelete: () => void
}

/** 批量删除按钮: 未选中账号时禁用 */
export function BulkDeleteButton({ count, onDelete }: BulkDeleteButtonProps) {
  return (
    <Button
      variant="outline"
      disabled={count === 0}
      onClick={onDelete}
      className="border-slate-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
    >
      <Trash2 className="h-4 w-4" />
      删除选中{count > 0 ? ` (${count})` : ''}
    </Button>
  )
}
