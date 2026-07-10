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
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Help — click or hover to see instructions"
        aria-expanded={show}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
          <div className={cn(
            "absolute left-full top-0 ml-2 z-50 w-64 sm:w-80 bg-card border border-border/60 rounded-md shadow-lg p-3 text-sm text-foreground leading-relaxed",
            className
          )}
            role="tooltip"
          >
            {text}
          </div>
        </>
      )}
    </div>
  )
}
