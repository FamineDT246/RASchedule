'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

import { StatsBar } from '@/components/scheduler/StatsBar'
import { RosterRail } from '@/components/scheduler/RosterRail'
import { CalendarGrid } from '@/components/scheduler/CalendarGrid'
import { EventDetailDrawer } from '@/components/scheduler/EventDetailDrawer'
import { DraggableInstructor } from '@/components/scheduler/DraggableInstructor'
import { EventsManagerTab } from '@/components/scheduler/EventsManagerTab'
import { InvitesTab } from '@/components/scheduler/InvitesTab'
import { TeamTab } from '@/components/scheduler/TeamTab'
import { ConflictSummaryTab } from '@/components/scheduler/ConflictSummaryTab'
import { PrintLayout } from '@/components/scheduler/PrintLayout'
import { CalendarView } from '@/components/scheduler/CalendarView'
import { WorkloadTab } from '@/components/scheduler/WorkloadTab'
import { LoginForm } from '@/components/scheduler/LoginForm'
import { InstructorView, ClaimInviteForm } from '@/components/scheduler/InstructorView'
import { PWAInstallPrompt } from '@/components/scheduler/PWAInstallPrompt'
import { ChevronDown, KeyRound, LogOut, User, X, CalendarDays } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-is-mobile'

import {
  startOfWeekISO, addDaysISO, formatShortDate, todayInBarbados,
  type ScheduleData, type AuthUser,
} from '@/lib/scheduler-types'

// ---- data fetch ----
async function fetchSchedule(): Promise<ScheduleData> {
  // Auto-archive past events + send reminders (fire-and-forget)
  fetch('/api/auto-archive', { method: 'POST' }).catch(() => {})
  fetch('/api/reminders', { method: 'POST' }).catch(() => {})
  const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
  if (!r.ok) throw new Error('Failed to load schedule')
  return r.json()
}

async function fetchMe(): Promise<{ user: AuthUser | null }> {
  const r = await fetch('/api/auth/me')
  if (!r.ok) return { user: null }
  return r.json()
}

type Tab = 'scheduler' | 'calendar' | 'events' | 'team' | 'conflicts' | 'workload' | 'invites'

export default function Home() {
  const qc = useQueryClient()

  // Auth state
  const { data: meData, refetch: refetchMe } = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const user = meData?.user ?? null

  // Token claim flow — read on client only to avoid hydration mismatch.
  // useSyncExternalStore returns empty string on server, real value on client.
  const [tokenOverride, setTokenOverride] = useState<string | null>(null)
  const clientToken = useSyncExternalStore(
    () => () => {},
    () => {
      if (typeof window === 'undefined') return ''
      if (tokenOverride !== null) return tokenOverride
      const url = new URL(window.location.href)
      return url.searchParams.get('token') ?? ''
    },
    () => '',
  )
  const claimToken = clientToken || null
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // Active tab
  const [tab, setTab] = useState<Tab>('scheduler')

  // Scheduler state
  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO('2026-07-06'))
  const [weekPinned, setWeekPinned] = useState(false)
  const [rosterCollapsed, setRosterCollapsed] = useState(false)
  const [selected, setSelected] = useState<{ eventId: string; date: string } | null>(null)
  const [activeDrag, setActiveDrag] = useState<{ profileId: string } | null>(null)
  const [printMode, setPrintMode] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [tapSelectedProfileId, setTapSelectedProfileId] = useState<string | null>(null)
  const isMobile = useIsMobile()

  // Prevent back button from accidentally leaving the app.
  // Push a dummy history state on mount; when user presses back, we intercept it
  // and show a toast instead of navigating away.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.pushState({ app: true }, '', window.location.href)

    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState({ app: true }, '', window.location.href)
      toast('Press back again to exit', {
        description: 'Use the tabs to navigate within the app.',
        duration: 3000,
      })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Close drawers/modals with Esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected) { setSelected(null); return }
      if (showChangePassword) { setShowChangePassword(false); return }
      if (tapSelectedProfileId) { setTapSelectedProfileId(null); return }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selected, showChangePassword, tapSelectedProfileId])

  // Print handler — renders PrintLayout to a portal, triggers window.print(), then cleans up
  const handlePrint = useCallback(() => {
    setPrintMode(true)
    document.body.classList.add('printing')
    // Wait for the print layout to render, then trigger print
    setTimeout(() => {
      window.print()
      // Cleanup after print dialog closes
      const cleanup = () => {
        setPrintMode(false)
        document.body.classList.remove('printing')
        window.removeEventListener('afterprint', cleanup)
      }
      window.addEventListener('afterprint', cleanup)
      // Fallback cleanup in case afterprint doesn't fire
      setTimeout(() => {
        setPrintMode(false)
        document.body.classList.remove('printing')
      }, 2000)
    }, 300)
  }, [])

  // Jump from Conflicts tab to an event in the Scheduler
  const handleJumpToEvent = useCallback((eventId: string, date: string) => {
    setTab('scheduler')
    setWeekPinned(true)
    setWeekStart(startOfWeekISO(date))
    setSelected({ eventId, date })
  }, [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
    enabled: !user || user.role === 'admin', // instructors use a different view
  })

  // On mobile, we use tap-to-assign instead of drag-drop.
  // The sensors are always created (hooks rule), but on mobile we set an impossible
  // activation distance so drag never triggers.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: isMobile ? 9999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
      disabled: isMobile,
    }),
  )

  // Auto-jump to the first event's week on first admin load.
  const effectiveWeekStart = !weekPinned && data?.events?.length
    ? startOfWeekISO(data.events[0].startDate)
    : weekStart
  const setWeek = useCallback((next: string | ((prev: string) => string)) => {
    setWeekPinned(true)
    setWeekStart(next)
  }, [])

  // ---- mutations ----
  const assignMutation = useMutation({
    mutationFn: async (args: { eventId: string; profileId: string; date: string; overrideFlag?: boolean }) => {
      const r = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const json = await r.json()
      if (!r.ok) throw { status: r.status, body: json }
      return json
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success(`Assigned`, { description: vars.date })
    },
    onError: (err: any, vars) => {
      const conflict = err?.body?.conflict
      if (conflict?.level === 'error') {
        toast.error(`Cannot assign — ${conflict.reasons.join('; ')}`)
      } else if (conflict?.level === 'warning') {
        // Only fatigue warnings reach here now (skill-match was removed)
        toast(`Warning: ${conflict.reasons.join('; ')}`, {
          description: 'Click to override and assign anyway.',
          duration: 8000,
          action: {
            label: 'Override',
            onClick: () => assignMutation.mutate({ ...vars, overrideFlag: true }),
          },
        })
      } else {
        toast.error(err?.body?.error || 'Failed to assign')
      }
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/assignments?id=${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to remove')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Removed from event')
    },
    onError: () => toast.error('Failed to remove'),
  })

  const patchAssignmentMutation = useMutation({
    mutationFn: async (args: { id: string; patch: { isAlternative?: boolean; shirtColor?: string | null } }) => {
      const r = await fetch(`/api/assignments?id=${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args.patch),
      })
      if (!r.ok) throw new Error('Failed to update')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
    },
    onError: () => toast.error('Failed to update assignment'),
  })

  // Multi-day assignment: drop onto the "↧ all days" handle
  const bulkAssignMutation = useMutation({
    mutationFn: async (args: { eventId: string; profileId: string }) => {
      const r = await fetch('/api/assignments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const j = await r.json()
      if (!r.ok && r.status !== 409) throw { status: r.status, body: j }
      return { status: r.status, body: j }
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      const { created, existing, conflicts, details } = res.body
      const parts: string[] = []
      if (created) parts.push(`${created} day${created > 1 ? 's' : ''} assigned`)
      if (existing) parts.push(`${existing} already assigned`)
      if (conflicts) parts.push(`${conflicts} conflict${conflicts > 1 ? 's' : ''} skipped`)
      toast.success(`Multi-day assign: ${parts.join(' · ')}`)
      // If there were conflicts, show the details
      if (conflicts > 0) {
        const conflictDetails = details
          .filter((d: any) => d.status === 'conflict')
          .map((d: any) => `${d.date}: ${d.conflict?.reasons.join('; ')}`)
          .join('\n')
        toast.warning('Conflicts skipped', { description: conflictDetails, duration: 10000 })
      }
    },
    onError: (err: any) => {
      toast.error(err?.body?.error || 'Failed to bulk assign')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => fetch('/api/auth/logout', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      setTab('scheduler')
      toast.success('Logged out')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (args: { currentPassword: string; newPassword: string }) => {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: () => {
      toast.success('Password changed')
      setShowChangePassword(false)
    },
    onError: (e: any) => toast.error(e.message || 'Failed to change password'),
  })

  // Tap-to-assign (mobile): when an instructor is selected and an event slot is tapped,
  // assign the instructor to that event+date.
  const handleTapAssign = useCallback((eventId: string, date: string) => {
    if (!tapSelectedProfileId) {
      // No instructor selected — just open the event drawer
      setSelected({ eventId, date })
      return
    }
    assignMutation.mutate({
      eventId,
      profileId: tapSelectedProfileId,
      date,
    })
    setTapSelectedProfileId(null)
  }, [tapSelectedProfileId, assignMutation])

  // ---- dnd handlers ----
  const onDragStart = (e: { active: { data: { current: any } } }) => {
    const d = e.active.data.current
    if (d?.type === 'profile') setActiveDrag({ profileId: d.profileId })
  }
  const onDragEnd = (e: { over?: { data: { current: any } } | null; active: { data: { current: any } } }) => {
    setActiveDrag(null)
    const overData = e.over?.data.current
    const activeData = e.active.data.current
    if (!overData || !activeData || activeData.type !== 'profile') return

    if (overData.type === 'event-drop-all') {
      // Multi-day assignment
      bulkAssignMutation.mutate({
        eventId: overData.eventId,
        profileId: activeData.profileId,
      })
    } else if (overData.type === 'event-drop') {
      // Single-day assignment
      assignMutation.mutate({
        eventId: overData.eventId,
        profileId: activeData.profileId,
        date: overData.date,
      })
    }
  }

  // ---- derived values ----
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(effectiveWeekStart, i)),
    [effectiveWeekStart],
  )

  const weekEvents = useMemo(() => {
    if (!data) return []
    return data.events.filter(ev =>
      weekDates.some(d => ev.startDate <= d && ev.endDate >= d),
    )
  }, [data, weekDates])

  const weekAssignments = useMemo(() => {
    if (!data) return []
    const set = new Set(weekDates)
    return data.assignments.filter(a => set.has(a.date))
  }, [data, weekDates])

  const { totalSlots, filledSlots, conflictCount } = useMemo(() => {
    if (!data) return { totalSlots: 0, filledSlots: 0, conflictCount: 0 }
    let total = 0, filled = 0, conflicts = 0
    for (const ev of weekEvents) {
      const eventDaysThisWeek = weekDates.filter(d => ev.startDate <= d && ev.endDate >= d)
      for (const d of eventDaysThisWeek) {
        total += ev.requiredInstructors
        const dayAssignments = weekAssignments.filter(a => a.eventId === ev.id && a.date === d)
        const primaries = dayAssignments.filter(a => !a.isAlternative).length
        filled += Math.min(primaries, ev.requiredInstructors)
        if (primaries > ev.requiredInstructors) conflicts += primaries - ev.requiredInstructors
      }
    }
    return { totalSlots: total, filledSlots: filled, conflictCount: conflicts }
  }, [data, weekEvents, weekAssignments, weekDates])

  const selectedEvent = selected ? data?.events.find(e => e.id === selected.eventId) ?? null : null
  const selectedAssignments = selected
    ? data?.assignments.filter(a => a.eventId === selected.eventId && a.date === selected.date) ?? []
    : []
  const selectedProfile = activeDrag ? data?.profiles.find(p => p.id === activeDrag.profileId) ?? null : null

  // ---- CLAIM FLOW ----
  // If the URL has ?token=..., show the claim form (or instructor view if already claimed).
  // Wait for mount to avoid hydration mismatch.
  if (mounted && claimToken) {
    if (user && (user.role === 'instructor' || user.role === 'admin')) {
      // Already claimed — show appropriate view
      if (user.role === 'instructor') {
        return (
          <div className="h-screen flex flex-col bg-background">
            <InstructorTopBar user={user} onLogout={() => logoutMutation.mutate()} onChangePassword={() => setShowChangePassword(true)} />
            <InstructorView user={user} />
          </div>
        )
      }
      // Admin with token in URL — just clear it and show admin view
      // (falls through to admin view below)
    } else {
      return (
        <ClaimInviteForm
          token={claimToken}
          onClaimed={() => {
            setTokenOverride('')
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.searchParams.delete('token')
              window.history.replaceState({}, '', url.toString())
            }
            refetchMe()
          }}
        />
      )
    }
  }

  // ---- LOGIN REQUIRED ----
  // After mount, if no user is logged in, show the login form.
  // This closes the security hole where logout → admin view.
  if (mounted && !user) {
    return <LoginForm onLoggedIn={() => refetchMe()} />
  }

  // ---- INSTRUCTOR VIEW ----
  if (mounted && user && user.role === 'instructor') {
    return (
      <div className="h-screen flex flex-col bg-background">
        <InstructorTopBar user={user} onLogout={() => logoutMutation.mutate()} onChangePassword={() => setShowChangePassword(true)} />
        <InstructorView user={user} />
        {showChangePassword && (
          <ChangePasswordModal
            onClose={() => setShowChangePassword(false)}
            onSubmit={(current, next) => changePasswordMutation.mutate({ currentPassword: current, newPassword: next })}
            saving={changePasswordMutation.isPending}
          />
        )}
      </div>
    )
  }

  // ---- ADMIN VIEW (only shown when user.role === 'admin') ----
  if (mounted && user && user.role !== 'admin') {
    // Safety net — shouldn't happen, but logout if it does
    return <LoginForm onLoggedIn={() => refetchMe()} />
  }

  // ---- ADMIN VIEW (default — also covers the boss who hasn't logged in) ----
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto mb-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading schedule…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm p-6">
          <p className="text-sm text-rose-400 mb-2">Failed to load schedule</p>
          <p className="text-xs text-muted-foreground mb-4">{String(error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd as any}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Skip link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-md focus:bg-emerald-500 focus:text-white focus:text-sm"
        >
          Skip to main content
        </a>
        <StatsBar
          totalSlots={totalSlots}
          filledSlots={filledSlots}
          conflictCount={conflictCount}
          weekLabel={formatShortDate(effectiveWeekStart)}
          userName={user?.name}
          userEmail={user?.email}
          onChangePassword={() => setShowChangePassword(true)}
          onLogout={() => logoutMutation.mutate()}
        />

        {/* Tab nav — horizontal scroll on mobile */}
        <nav
          className="border-b border-border/60 bg-card/30 flex items-center gap-1 px-3 overflow-x-auto"
          role="tablist"
          aria-label="Main navigation"
        >
          <TabButton active={tab === 'scheduler'} onClick={() => setTab('scheduler')}>
            Scheduler
          </TabButton>
          <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')}>
            Calendar
          </TabButton>
          <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
            Events
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({data.events.length})
            </span>
          </TabButton>
          <TabButton active={tab === 'team'} onClick={() => setTab('team')}>
            Team
          </TabButton>
          <TabButton active={tab === 'conflicts'} onClick={() => setTab('conflicts')}>
            Conflicts
          </TabButton>
          <TabButton active={tab === 'workload'} onClick={() => setTab('workload')}>
            Workload
          </TabButton>
          <TabButton active={tab === 'invites'} onClick={() => setTab('invites')}>
            Invites
          </TabButton>
        </nav>

        <div className="flex-1 flex min-h-0 relative" id="main-content" role="main">
          {tab === 'scheduler' && (
            <>
              <RosterRail
                profiles={data.profiles}
                collapsed={rosterCollapsed}
                onToggleCollapsed={() => setRosterCollapsed(c => !c)}
                tapSelectMode={isMobile}
                selectedProfileId={tapSelectedProfileId}
                onTapProfile={(id) => setTapSelectedProfileId(id === tapSelectedProfileId ? null : id)}
              />
              <CalendarGrid
                weekStartISO={effectiveWeekStart}
                events={weekEvents}
                assignments={weekAssignments}
                selected={selected}
                onSelect={isMobile ? handleTapAssign : (eventId, date) => setSelected({ eventId, date })}
                onPrevWeek={() => setWeek(w => addDaysISO(w, -7))}
                onNextWeek={() => setWeek(w => addDaysISO(w, 7))}
                onJumpToday={() => setWeek(startOfWeekISO(todayInBarbados()))}
                onPrint={handlePrint}
                tapAssignMode={isMobile}
                hasSelectedProfile={!!tapSelectedProfileId}
              />
              <AnimatePresence>
                {selectedEvent && (
                  <motion.div
                    key="drawer"
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                    className="absolute inset-y-0 right-0"
                  >
                    <EventDetailDrawer
                      event={selectedEvent}
                      date={selected?.date ?? null}
                      assignments={selectedAssignments}
                      profiles={data.profiles}
                      onClose={() => setSelected(null)}
                      onRemove={(id) => removeMutation.mutate(id)}
                      onUpdateAssignment={(id, patch) => patchAssignmentMutation.mutate({ id, patch })}
                      onBulkShirtColor={(eventId, date, shirtColor) => {
                        // Update all assignments for this event+date
                        const dayAssignments = data.assignments.filter(
                          a => a.eventId === eventId && a.date === date && !a.isAlternative
                        )
                        for (const a of dayAssignments) {
                          patchAssignmentMutation.mutate({ id: a.id, patch: { shirtColor } })
                        }
                        toast.success(`Set all shirts to ${shirtColor}`)
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile: floating selected-instructor bar */}
              {isMobile && tapSelectedProfileId && (
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-md border-t border-border/60 p-3 flex items-center justify-between gap-2 shadow-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                      {data.profiles.find(p => p.id === tapSelectedProfileId)?.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {data.profiles.find(p => p.id === tapSelectedProfileId)?.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Tap an event to assign</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTapSelectedProfileId(null)}
                    className="p-2 rounded-md hover:bg-muted text-muted-foreground shrink-0"
                    aria-label="Cancel selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'calendar' && (
            <CalendarView
              events={data.events}
              assignments={data.assignments}
              profiles={data.profiles}
              onSelect={(eventId, date) => setSelected({ eventId, date })}
            />
          )}
          {tab === 'events' && <EventsManagerTab />}
          {tab === 'team' && <TeamTab />}
          {tab === 'conflicts' && <ConflictSummaryTab onJumpToEvent={handleJumpToEvent} />}
          {tab === 'workload' && <WorkloadTab />}
          {tab === 'invites' && <InvitesTab />}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {selectedProfile ? (
          <div className="w-64 pointer-events-none opacity-90 rotate-2">
            <DraggableInstructor profile={selectedProfile} />
          </div>
        ) : null}
      </DragOverlay>

      {/* Print portal — rendered outside the main layout, shown only when printing */}
      {printMode && data && (
        <div id="print-portal">
          <PrintLayout
            weekStartISO={effectiveWeekStart}
            events={weekEvents}
            assignments={weekAssignments}
          />
        </div>
      )}

      {/* Change password modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSubmit={(current, next) => changePasswordMutation.mutate({ currentPassword: current, newPassword: next })}
          saving={changePasswordMutation.isPending}
        />
      )}

      <PWAInstallPrompt />
    </DndContext>
  )
}

function TabButton({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[40px] flex items-center ${
        active
          ? 'border-emerald-400 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function InstructorTopBar({ user, onLogout, onChangePassword }: {
  user: AuthUser
  onLogout: () => void
  onChangePassword: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="border-b border-border/60 bg-card/40 px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <img src="/logo.png" alt="RA Syncbot" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover shrink-0" />
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold leading-tight truncate">
            Hi {user.name.split(' ')[0]}
          </h1>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
            {user.profile ? 'Opt in to events below' : 'No profile linked'}
          </p>
        </div>
      </div>
      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="px-2 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground flex items-center gap-1 min-h-[32px]"
          aria-label="Account menu"
          aria-expanded={menuOpen}
        >
          <User className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card border border-border/60 rounded-md shadow-lg py-1">
              <div className="px-3 py-2 border-b border-border/40">
                <p className="text-xs font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); onChangePassword() }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Change password
              </button>
              <a
                href={`/api/ical?token=${user.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2"
                onClick={() => setMenuOpen(false)}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Subscribe to calendar
              </a>
              <button
                onClick={() => { setMenuOpen(false); onLogout() }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted text-rose-300 flex items-center gap-2"
              >
                <LogOut className="h-3.5 w-3.5" />
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function ChangePasswordModal({ onClose, onSubmit, saving }: {
  onClose: () => void
  onSubmit: (current: string, next: string) => void
  saving: boolean
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const canSubmit = current && next.length >= 6 && next === confirm && !saving

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Change password"
    >
      <div
        className="bg-card border border-border/60 rounded-lg p-6 max-w-sm w-full space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">Change Password</h2>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
            Current password
          </label>
          <input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
            New password (min 6 characters)
          </label>
          <input
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
            Confirm new password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSubmit && onSubmit(current, next)}
            className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[36px]"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onSubmit(current, next)}
            disabled={!canSubmit}
            className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[36px]"
          >
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </div>
    </div>
  )
}
