'use client'

import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  text: string
  className?: string
}

export function HelpTooltip({ text, className }: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex shrink-0">
      <button
        onClick={() => setShow(s => !s)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Help"
        aria-expanded={show}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {show && (
        <div className={cn(
          "absolute left-full top-0 ml-2 z-50 w-64 sm:w-80 bg-card border border-border/60 rounded-md shadow-lg p-3 text-sm text-foreground leading-relaxed",
          className
        )}
        role="tooltip"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to use</span>
            <button
              onClick={() => setShow(false)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
              aria-label="Close help"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {text}
        </div>
      )}
    </div>
  )
}
