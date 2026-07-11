'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * "Install app" menu item for the account dropdown.
 *
 * On Android Chrome: uses the deferred beforeinstallprompt event (the same
 * one the auto-prompt uses, but triggered manually from the menu).
 *
 * On iOS Safari: there's no beforeinstallprompt event, so we show a small
 * instructions popover instead (Share → Add to Home Screen).
 *
 * Only renders on mobile (sm:hidden) — desktop browsers reliably fire
 * the auto-prompt, so the menu item isn't needed there.
 */
export function InstallAppMenuItem({ onAfterAction }: { onAfterAction?: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosInstructions, setShowIosInstructions] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Detect iOS (Safari can't auto-prompt)
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )

  // Detect if already installed (standalone mode)
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     (navigator as any).standalone === true)

  // Don't render if already installed
  if (isStandalone) return null

  const handleClick = () => {
    if (deferredPrompt) {
      // Android Chrome — trigger the native install prompt
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null)
        onAfterAction?.()
      })
    } else if (isIOS) {
      // iOS — show instructions popover
      setShowIosInstructions(true)
    }
    // If not iOS and no deferredPrompt (rare), do nothing — the auto-prompt
    // should have fired if the browser supports it
  }

  return (
    <>
      {/* Only render on mobile (sm:hidden) */}
      <button
        onClick={handleClick}
        className="sm:hidden w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
      >
        <Download className="h-3.5 w-3.5" />
        Install app
      </button>

      {/* iOS instructions popover */}
      {showIosInstructions && (
        <div
          className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0"
          onClick={() => setShowIosInstructions(false)}
        >
          <div
            className="bg-card border border-border/60 rounded-t-lg w-full max-w-md p-4 pb-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold">Install RA Syncbot</p>
                <p className="text-[11px] text-muted-foreground">Add to your home screen</p>
              </div>
              <button
                onClick={() => setShowIosInstructions(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-2 text-xs text-foreground/90">
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-300 shrink-0">1.</span>
                <span>Tap the <strong>Share</strong> button in Safari's toolbar (square with an up arrow).</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-300 shrink-0">2.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-300 shrink-0">3.</span>
                <span>Tap <strong>Add</strong> — the RA Syncbot icon will appear on your home screen.</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
