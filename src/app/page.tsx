'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

import { StatsBar } from '@/components/scheduler/StatsBar'
import { RosterRail } from '@/components/scheduler/RosterRail'
import { CalendarGrid } from '@/components/scheduler/CalendarGrid'
import { EventDetailDrawer } from '@/components/scheduler/EventDetailDrawer'
import { DraggableInstructor } from '@/components/scheduler/DraggableInstructor'

import {
  startOfWeekISO, addDaysISO, formatShortDate,
  type ScheduleData, type ProfileView, type EventView, type AssignmentView,
} from '@/lib/scheduler-types'

// ---- data fetch ----
async function fetchSchedule(): Promise<ScheduleData> {
  const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
  if (!r.ok) throw new Error('Failed to load schedule')
  return r.json()
}

export default function Home() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
  })

  const [weekStart, setWeekStart] = useState<string>(() => startOfWeekISO('2026-07-06'))
  const [weekPinned, setWeekPinned] = useState(false)
  const [rosterCollapsed, setRosterCollapsed] = useState(false)
  const [selected, setSelected] = useState<{ eventId: string; date: string } | null>(null)
  const [activeDrag, setActiveDrag] = useState<{ profileId: string } | null>(null)
  const [reseeding, setReseeding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Jump to the first event's week on first data load (without setState-in-effect).
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
      toast.success(`Assigned to ${vars.date}`, { description: 'Instructor added to event' })
    },
    onError: (err: any, vars) => {
      const conflict = err?.body?.conflict
      if (conflict?.level === 'error') {
        toast.error(`Cannot assign — ${conflict.reasons.join('; ')}`)
      } else if (conflict?.level === 'warning') {
        // Confirm override
        toast(
          `Warning: ${conflict.reasons.join('; ')}`,
          {
            description: 'Click to override and assign anyway.',
            duration: 8000,
            action: {
              label: 'Override',
              onClick: () => {
                assignMutation.mutate({ ...vars, overrideFlag: true })
              },
            },
          },
        )
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

  const reseedMutation = useMutation({
    mutationFn: async () => {
      setReseeding(true)
      const r = await fetch('/api/seed', { method: 'POST' })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Failed to reseed')
      return json
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Database reset to seed data')
    },
    onError: (e: any) => toast.error(e.message || 'Reseed failed'),
    onSettled: () => setReseeding(false),
  })

  // ---- dnd handlers ----
  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any
    if (data?.type === 'profile') {
      setActiveDrag({ profileId: data.profileId })
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null)
    const overData = e.over?.data.current as any
    const activeData = e.active.data.current as any
    if (!overData || overData.type !== 'event-drop') return
    if (!activeData || activeData.type !== 'profile') return
    assignMutation.mutate({
      eventId: overData.eventId,
      profileId: activeData.profileId,
      date: overData.date,
    })
  }

  // ---- derived values ----
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysISO(effectiveWeekStart, i))
  }, [effectiveWeekStart])

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

  // For stats — count all unfilled slots across the visible week
  const { totalSlots, filledSlots, conflictCount } = useMemo(() => {
    if (!data) return { totalSlots: 0, filledSlots: 0, conflictCount: 0 }
    let total = 0, filled = 0, conflicts = 0
    for (const ev of weekEvents) {
      // for each weekday the event runs in this week, count one "slot" set
      const eventDaysThisWeek = weekDates.filter(d => ev.startDate <= d && ev.endDate >= d)
      for (const d of eventDaysThisWeek) {
        total += ev.requiredInstructors
        const count = weekAssignments.filter(a => a.eventId === ev.id && a.date === d).length
        filled += Math.min(count, ev.requiredInstructors)
        if (count > ev.requiredInstructors) conflicts += count - ev.requiredInstructors
      }
    }
    return { totalSlots: total, filledSlots: filled, conflictCount: conflicts }
  }, [data, weekEvents, weekAssignments, weekDates])

  // Drawer data
  const selectedEvent = selected ? data?.events.find(e => e.id === selected.eventId) ?? null : null
  const selectedAssignments = selected
    ? data?.assignments.filter(a => a.eventId === selected.eventId && a.date === selected.date) ?? []
    : []
  const selectedProfile = activeDrag ? data?.profiles.find(p => p.id === activeDrag.profileId) ?? null : null

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
            onClick={() => reseedMutation.mutate()}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
          >
            Reset & reseed database
          </button>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <StatsBar
          totalSlots={totalSlots}
          filledSlots={filledSlots}
          conflictCount={conflictCount}
          weekLabel={formatShortDate(effectiveWeekStart)}
          onReseed={() => reseedMutation.mutate()}
          reseeding={reseeding}
        />

        <div className="flex-1 flex min-h-0 relative">
          <RosterRail
            profiles={data.profiles}
            collapsed={rosterCollapsed}
            onToggleCollapsed={() => setRosterCollapsed(c => !c)}
          />

          <CalendarGrid
            weekStartISO={effectiveWeekStart}
            events={weekEvents}
            assignments={weekAssignments}
            selected={selected}
            onSelect={(eventId, date) => setSelected({ eventId, date })}
            onPrevWeek={() => setWeek(w => addDaysISO(w, -7))}
            onNextWeek={() => setWeek(w => addDaysISO(w, 7))}
            onJumpToday={() => setWeek(startOfWeekISO(new Date().toISOString().slice(0, 10)))}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {selectedProfile ? (
          <div className="w-64 pointer-events-none opacity-90 rotate-2">
            <DraggableInstructor profile={selectedProfile} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
