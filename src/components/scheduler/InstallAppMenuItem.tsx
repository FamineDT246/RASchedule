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
 * Always shows a bottom-sheet with install instructions when tapped, so the
 * button always responds (no dead taps). The instructions are tailored to
 * the detected platform:
 *
 * - Android Chrome/Samsung (with beforeinstallprompt): tries the native
 *   install prompt first; if that fails, falls back to manual instructions
 * - iOS Safari: manual Share → Add to Home Screen instructions
 * - Other: generic "Add to Home Screen" instructions
 *
 * Only renders on mobile (sm:hidden) and only when not already in
 * standalone mode (i.e. PWA not yet installed).
 *
 * NOTE: For the native Android install prompt to fire, the app needs a
 * service worker registered. See /sw.js (registered in layout.tsx).
 */
export function InstallAppMenuItem({ onAfterAction }: { onAfterAction?: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Detect platform
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  // Detect if already installed (standalone mode)
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     (navigator as any).standalone === true)

  // Don't render if already installed
  if (isStandalone) return null

  const handleClick = async () => {
    // Close the account menu first
    onAfterAction?.()

    // If we have a deferred prompt (Android Chrome with SW), try the native prompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        if (choice.outcome === 'accepted') {
          setDeferredPrompt(null)
          return // installed — don't show instructions
        }
        // dismissed — fall through to show manual instructions
      } catch {
        // prompt failed — fall through to manual instructions
      }
    }

    // Always show instructions as fallback / for iOS
    setShowInstructions(true)
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

      {/* Instructions popover — always available as fallback */}
      {showInstructions && (
        <div
          className="sm:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0"
          onClick={() => setShowInstructions(false)}
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
                onClick={() => setShowInstructions(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3 text-xs text-foreground/90">
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-300 shrink-0">1.</span>
                  <span>Tap the <strong>Share</strong> button in Safari's toolbar (square with an up-arrow).</span>
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
            ) : isAndroid ? (
              <ol className="space-y-3 text-xs text-foreground/90">
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-300 shrink-0">1.</span>
                  <span>Tap the <strong>three-dot menu</strong> (⋮) in the top-right corner of your browser.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-300 shrink-0">2.</span>
                  <span>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-300 shrink-0">3.</span>
                  <span>Tap <strong>Install</strong> — the RA Syncbot icon will appear on your home screen.</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-xs text-foreground/90">
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-300 shrink-0">1.</span>
                  <span>Open your browser menu and look for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-emerald-300 shrink-0">2.</span>
                  <span>Confirm — the RA Syncbot icon will appear on your home screen.</span>
                </li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  )
}
