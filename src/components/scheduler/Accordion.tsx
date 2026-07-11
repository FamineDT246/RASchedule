'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  count?: number
  labelClassName?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function Accordion({ label, count, labelClassName, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-border/60 bg-card/30 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-[11px] uppercase tracking-wide px-2 py-0.5 rounded border', labelClassName)}>
            {label}
          </span>
          {count !== undefined && (
            <span className="text-[10px] text-muted-foreground">{count}</span>
          )}
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
          open ? 'rotate-180' : 'rotate-0',
        )} />
      </button>
      {open && (
        <div className="p-2 pt-0 space-y-2">
          {children}
        </div>
      )}
    </section>
  )
}
