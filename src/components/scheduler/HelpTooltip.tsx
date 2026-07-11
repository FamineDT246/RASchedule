'use client'

import { useState, useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  text: string
  className?: string
}

export function HelpTooltip({ text, className }: Props) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside (for desktop absolute tooltip)
  useEffect(() => {
    if (!show) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [show])

  return (
    <div className="relative inline-flex shrink-0" ref={ref}>
      <button
        onClick={() => setShow(s => !s)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Help — click to toggle instructions"
        aria-expanded={show}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {show && (
        <>
          {/* Mobile: fixed bottom sheet — no clipping */}
          <div
            className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border/60 rounded-t-lg shadow-2xl p-4 max-h-[60vh] overflow-y-auto"
            role="tooltip"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to use</span>
              <button
                onClick={() => setShow(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{text}</p>
          </div>

          {/* Desktop: absolute positioned tooltip */}
          <div
            className={cn(
              "hidden sm:block absolute right-0 top-full mt-2 z-50 w-80 bg-card border border-border/60 rounded-md shadow-lg p-3 text-sm text-foreground leading-relaxed",
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
        </>
      )}
    </div>
  )
}
