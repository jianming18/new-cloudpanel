import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/format'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      tone: {
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        danger: 'border-red-200 bg-red-50 text-red-700',
        muted: 'border-slate-200 bg-slate-50 text-slate-600',
        info: 'border-sky-200 bg-sky-50 text-sky-700',
      },
    },
    defaultVariants: { tone: 'muted' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  tone?: Tone
}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }
