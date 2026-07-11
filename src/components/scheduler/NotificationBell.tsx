'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatShortDate } from '@/lib/scheduler-types'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  eventId: string | null
  readAt: string | null
  createdAt: string
  read: boolean
}

async function fetchNotifications(): Promise<{ notifications: Notification[]; unread: number }> {
  const r = await fetch('/api/notifications')
  if (!r.ok) return { notifications: [], unread: 0 }
  return r.json()
}

const TYPE_ICON: Record<string, string> = {
  assignment_created: '📅',
  assignment_removed: '❌',
  opt_in_received: '⭐',
  event_changed: '📝',
  reminder: '⏰',
  equipment_claimed: '📦',
}

const TYPE_COLOR: Record<string, string> = {
  assignment_created: 'text-emerald-300',
  assignment_removed: 'text-rose-300',
  opt_in_received: 'text-teal-300',
  event_changed: 'text-amber-300',
  reminder: 'text-sky-300',
  equipment_claimed: 'text-purple-300',
}

export function NotificationBell() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // poll every 30s for new notifications
  })

  const markReadMutation = useMutation({
    mutationFn: async (id?: string) => {
      const url = id ? `/api/notifications/read?id=${id}` : '/api/notifications/read'
      const r = await fetch(url, { method: 'POST' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = data?.unread ?? 0
  const notifications = data?.notifications ?? []

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 max-w-[calc(100vw-1rem)] bg-card border border-border/60 rounded-md shadow-lg flex flex-col max-h-[70vh]">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <p className="text-xs font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => markReadMutation.mutate(undefined)}
                className="text-[10px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markReadMutation.mutate(n.id)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-border/30 hover:bg-muted/40 transition-colors flex items-start gap-2',
                    !n.read && 'bg-emerald-500/[0.04]',
                  )}
                >
                  <span className="text-base shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] ?? '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs leading-tight', !n.read && 'font-medium', TYPE_COLOR[n.type] ?? '')}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" aria-label="Unread" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return formatShortDate(iso.slice(0, 10))
}
