'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
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
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        aria-label="Help"
        aria-expanded={show}
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className={cn(
            "absolute right-0 top-full mt-1 z-50 w-64 sm:w-80 bg-card border border-border/60 rounded-md shadow-lg p-3 text-xs text-muted-foreground leading-relaxed",
            className
          )}>
            {text}
          </div>
        </>
      )}
    </div>
  )
}
