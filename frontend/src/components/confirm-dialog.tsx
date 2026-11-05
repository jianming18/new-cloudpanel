import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  onConfirm: () => Promise<void> | void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelText}
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={handleConfirm} disabled={pending}>
            {pending ? '处理中…' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
