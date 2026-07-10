'use client'

import { useEffect, useState } from 'react'

// Returns true when the viewport is mobile-width (< 640px).
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobile(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}
