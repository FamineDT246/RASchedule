'use client'

import { useState, useEffect } from 'react'

// Returns true when the viewport is mobile-width (< 640px).
// Uses useSyncExternalStore pattern to avoid hydration mismatch.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}
