'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  hostColor, formatTime, formatPrettyDate, formatShortDate,
  EVENT_STATUS_COLOR, type EventView, type AssignmentView, type AuthUser,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  Calendar, Clock, MapPin, Users, Check, X, Star, AlertCircle, Shield, Shirt,
  ChevronLeft, ChevronRight, Plus, Trash2, LayoutGrid, List, X as XIcon, CalendarDays,
} from 'lucide-react'
import { Accordion } from './Accordion'
import { CalendarView } from './CalendarView'

type OptInMap = Record<string, { status: string; note: string | null }>

async function fetchSchedule() {
  const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
  if (!r.ok) throw new Error('Failed to load schedule')
  return r.json()
}

async function fetchMyOptIns(): Promise<OptInMap> {
  const r = await fetch('/api/opt-ins')
  if (!r.ok) throw new Error('Failed to load opt-ins')
  const list = await r.json()
  const map: OptInMap = {}
  for (const o of list) {
    map[o.eventId] = { status: o.status, note: o.note }
  }
  return map
}

async function fetchMyProfile() {
  const profileId = 'me' // The API will use the cookie to find the user's profile
  const r = await fetch('/api/profiles/me')
  if (!r.ok) return null
  return r.json()
}

export function InstructorView({ user }: { user: AuthUser }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['schedule'], queryFn: fetchSchedule })
  const { data: optIns } = useQuery({ queryKey: ['my-opt-ins'], queryFn: fetchMyOptIns })
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: fetchMyProfile })
  const [viewMode, setViewMode] = useState<'carousel' | 'list' | 'calendar'>('carousel')
  const [selectedEvent, setSelectedEvent] = useState<EventView | null>(null)

  const optInMutation = useMutation({
    mutationFn: async (args: { eventId: string; status: string }) => {
      const r = await fetch('/api/opt-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-opt-ins'] })
      toast.success('Preference saved')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save preference'),
  })

  // My assignments = assignments where profileId matches the linked profile
  const myProfileId = user.profile?.id
  const myAssignments = useMemo(() => {
    if (!data || !myProfileId) return []
    return (data.assignments as AssignmentView[])
      .filter(a => a.profileId === myProfileId)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data, myProfileId])

  // Available events to opt in to (Confirmed + Tentative, exclude Draft/Cancelled)
  const optableEvents = useMemo(() => {
    if (!data) return []
    return (data.events as EventView[])
      .filter(e => e.status === 'Confirmed' || e.status === 'Tentative')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [data])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="px-3 sm:px-4 py-2 border-b border-border/60 bg-card/40 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
          Opt in to events you&apos;d like to work
        </p>
        <div className="flex rounded-md border border-border/60 overflow-hidden shrink-0 ml-auto">
          <button
            onClick={() => setViewMode('carousel')}
            className={cn(
              'px-2.5 py-1.5 text-xs flex items-center gap-1 min-h-[32px]',
              viewMode === 'carousel'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            aria-pressed={viewMode === 'carousel'}
            title="Carousel view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'px-2.5 py-1.5 text-xs flex items-center gap-1 min-h-[32px] border-l border-border/60',
              viewMode === 'list'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            aria-pressed={viewMode === 'list'}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              'px-2.5 py-1.5 text-xs flex items-center gap-1 min-h-[32px] border-l border-border/60',
              viewMode === 'calendar'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
            aria-pressed={viewMode === 'calendar'}
            title="Month calendar view"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {viewMode === 'calendar' && data ? (
        <CalendarView
          events={data.events}
          assignments={data.assignments}
          myProfileId={user.profile?.id}
          readOnly
        />
      ) : (
      <div className="flex-1 overflow-y-auto" role="region" aria-label="My schedule and opt-ins">
        <div className="p-4 space-y-6">
          {viewMode === 'carousel' ? (
            <>
              {/* My assignments carousel */}
              <Carousel
                title="My Assignments"
                icon={<Calendar className="h-3 w-3" />}
                count={myAssignments.length}
                emptyMessage={user.profile
                  ? 'You have no assignments yet. Opt in to events below to let the boss know you\'re interested.'
                  : 'No staff profile linked. Ask the boss to link your account to a staff profile so you can be assigned.'}
              >
                {myAssignments.map(a => {
                  const ev = data?.events.find((e: EventView) => e.id === a.eventId)
                  if (!ev) return null
                  const colors = hostColor(ev.hostColor)
                  return (
                    <div key={a.id} className={cn(
                      'min-w-[300px] sm:min-w-[340px] rounded-lg border p-4 flex flex-col gap-2',
                      a.isAlternative
                        ? 'border-amber-500/30 border-dashed bg-amber-500/5'
                        : 'border-border/60 bg-card/80',
                    )}>
                      <div className={cn('h-1 rounded-full', colors.bar)} />
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate flex-1">{ev.name}</p>
                        {a.isAlternative && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-0.5 shrink-0">
                            <Shield className="h-2.5 w-2.5" /> Alt
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatPrettyDate(a.date)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTime(ev.startTime)}
                        </span>
                      </div>
                      {ev.location && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                          <MapPin className="h-2.5 w-2.5" />
                          {ev.location}
                        </div>
                      )}
                      {a.shirtColor && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Shirt className="h-2.5 w-2.5" />
                          Shirt: <span className="text-foreground font-medium">{a.shirtColor}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </Carousel>

              {/* Opt-in events carousel */}
              <Carousel
                title="Events You Can Opt In To"
                icon={<Star className="h-3 w-3" />}
                count={optableEvents.length}
                emptyMessage="No events available for opt-in right now."
              >
                {optableEvents.map(ev => {
                  const colors = hostColor(ev.hostColor)
                  const optIn = optIns?.[ev.id]
                  const isAssigned = myAssignments.some(a => a.eventId === ev.id)
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="min-w-[300px] sm:min-w-[340px] rounded-lg border border-border/60 bg-card/80 p-4 flex flex-col gap-2 cursor-pointer hover:border-foreground/30 hover:shadow-md transition-all"
                    >
                      <div className={cn('h-1 rounded-full', colors.bar)} />
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{ev.name}</p>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {formatShortDate(ev.startDate)}{ev.endDate !== ev.startDate && ` – ${formatShortDate(ev.endDate)}`}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatTime(ev.startTime)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Users className="h-2.5 w-2.5" />
                              {ev.requiredInstructors}
                            </span>
                            <span className={cn('px-1.5 py-0.5 rounded border', EVENT_STATUS_COLOR[ev.status] ?? EVENT_STATUS_COLOR.Confirmed)}>
                              {ev.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      {ev.location && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {ev.location}
                        </div>
                      )}
                      {ev.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{ev.description}</p>
                      )}

                      {isAssigned ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                          <Check className="h-3 w-3" />
                          You&apos;re assigned to this event
                        </div>
                      ) : (
                        <div className="flex gap-1.5 mt-1">
                          <OptInButton
                            active={optIn?.status === 'interested'}
                            color="active:bg-teal-500/20 bg-teal-500/10 text-teal-300 border-teal-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'interested' }) }}
                            icon={<Star className="h-3 w-3" />}
                            label="Interested"
                          />
                          <OptInButton
                            active={optIn?.status === 'available'}
                            color="active:bg-emerald-500/20 bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'available' }) }}
                            icon={<Check className="h-3 w-3" />}
                            label="Available"
                          />
                          <OptInButton
                            active={optIn?.status === 'unavailable'}
                            color="active:bg-rose-500/20 bg-rose-500/10 text-rose-300 border-rose-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'unavailable' }) }}
                            icon={<X className="h-3 w-3" />}
                            label="Can&apos;t"
                          />
                        </div>
                      )}
                      <p className="text-[9px] text-muted-foreground/50 text-center pt-1">Tap for details</p>
                    </div>
                  )
                })}
              </Carousel>
            </>
          ) : (
            /* List view (accordion) */
            <>
              <Accordion
                label={`My Assignments (${myAssignments.length})`}
                labelClassName="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                defaultOpen
              >
                {myAssignments.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">
                    {user.profile
                      ? 'No assignments yet. Opt in to events below.'
                      : 'No staff profile linked.'}
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    {myAssignments.map(a => {
                      const ev = data?.events.find((e: EventView) => e.id === a.eventId)
                      if (!ev) return null
                      const colors = hostColor(ev.hostColor)
                      return (
                        <div key={a.id} className={cn(
                          'rounded-lg border p-3 flex items-center gap-3',
                          a.isAlternative
                            ? 'border-amber-500/30 border-dashed bg-amber-500/5'
                            : 'border-border/60 bg-card/80',
                        )}>
                          <div className={cn('h-8 w-1 rounded-full shrink-0', colors.bar)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{ev.name}</p>
                              {a.isAlternative && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-0.5 shrink-0">
                                  <Shield className="h-2.5 w-2.5" /> Alt
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                {formatPrettyDate(a.date)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(ev.startTime)}
                              </span>
                              {a.shirtColor && (
                                <span className="flex items-center gap-0.5">
                                  <Shirt className="h-2.5 w-2.5" />
                                  {a.shirtColor}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Accordion>

              <Accordion
                label={`Events You Can Opt In To (${optableEvents.length})`}
                labelClassName="bg-teal-500/15 text-teal-300 border-teal-500/30"
                defaultOpen
              >
                {optableEvents.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">No events available.</div>
                ) : (
                  <div className="space-y-2 pt-2">
                    {optableEvents.map(ev => {
                      const colors = hostColor(ev.hostColor)
                      const optIn = optIns?.[ev.id]
                      const isAssigned = myAssignments.some(a => a.eventId === ev.id)
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className="rounded-lg border border-border/60 bg-card/80 p-3 cursor-pointer hover:border-foreground/30 transition-all"
                        >
                          <div className="flex items-start gap-2">
                            <div className={cn('h-8 w-1 rounded-full shrink-0', colors.bar)} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{ev.name}</p>
                              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {formatShortDate(ev.startDate)}{ev.endDate !== ev.startDate && ` – ${formatShortDate(ev.endDate)}`}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatTime(ev.startTime)}
                                </span>
                                {ev.location && (
                                  <span className="flex items-center gap-0.5 truncate">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {ev.location}
                                  </span>
                                )}
                              </div>
                              {isAssigned ? (
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                                  <Check className="h-3 w-3" />
                                  You&apos;re assigned to this event
                                </div>
                              ) : (
                                <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                                  <OptInButton
                                    active={optIn?.status === 'interested'}
                                    color="active:bg-teal-500/20 bg-teal-500/10 text-teal-300 border-teal-500/40"
                                    onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'interested' }) }}
                                    icon={<Star className="h-3 w-3" />}
                                    label="Interested"
                                  />
                                  <OptInButton
                                    active={optIn?.status === 'available'}
                                    color="active:bg-emerald-500/20 bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                                    onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'available' }) }}
                                    icon={<Check className="h-3 w-3" />}
                                    label="Available"
                                  />
                                  <OptInButton
                                    active={optIn?.status === 'unavailable'}
                                    color="active:bg-rose-500/20 bg-rose-500/10 text-rose-300 border-rose-500/40"
                                    onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'unavailable' }) }}
                                    icon={<X className="h-3 w-3" />}
                                    label="Can&apos;t"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Accordion>
            </>
          )}

          {/* Availability section */}
          {user.profile && (
            <AvailabilitySection profileId={user.profile.id} initialUnavailable={myProfile?.unavailableList ?? user.profile.unavailable?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? []} />
          )}
        </div>
      </div>
      )}

      {/* Event details drawer */}
      {selectedEvent && (
        <InstructorEventDrawer
          event={selectedEvent}
          optIn={optIns?.[selectedEvent.id]}
          isAssigned={myAssignments.some(a => a.eventId === selectedEvent.id)}
          onOptIn={(status) => optInMutation.mutate({ eventId: selectedEvent.id, status })}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

// ---------- Carousel component ----------

function Carousel({ title, icon, count, emptyMessage, children }: {
  title: string
  icon: React.ReactNode
  count: number
  emptyMessage: string
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          {icon}
          {title} ({count})
        </h3>
        {count > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="p-1 rounded-md border border-border/60 text-muted-foreground disabled:opacity-30 hover:bg-muted min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="p-1 rounded-md border border-border/60 text-muted-foreground disabled:opacity-30 hover:bg-muted min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {count === 0 ? (
        <div className="text-xs text-muted-foreground p-4 border border-dashed border-border/60 rounded-md text-center">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin' }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

// ---------- Event details drawer (instructor view) ----------

function InstructorEventDrawer({ event, optIn, isAssigned, onOptIn, onClose }: {
  event: EventView
  optIn?: { status: string; note: string | null }
  isAssigned: boolean
  onOptIn: (status: 'interested' | 'available' | 'unavailable') => void
  onClose: () => void
}) {
  const colors = hostColor(event.hostColor)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={event.name}
    >
      <div
        className="bg-card border border-border/60 rounded-t-lg sm:rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('h-1 rounded-t-lg', colors.bar)} />
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground">{event.code ?? 'No code'}</p>
              <h2 className="text-base font-semibold leading-tight">{event.name}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', colors.chip)}>
                  {event.host}
                </span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', EVENT_STATUS_COLOR[event.status] ?? EVENT_STATUS_COLOR.Confirmed)}>
                  {event.status}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Calendar className="h-3 w-3" />
                Dates
              </div>
              <p className="text-xs font-medium">
                {formatShortDate(event.startDate)}{event.endDate !== event.startDate && ` – ${formatShortDate(event.endDate)}`}
              </p>
            </div>
            <div className="p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Clock className="h-3 w-3" />
                Time
              </div>
              <p className="text-xs font-medium">{formatTime(event.startTime)} – {formatTime(event.endTime)}</p>
            </div>
            {event.location && (
              <div className="p-2 rounded-md bg-muted/30 border border-border/40">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                  <MapPin className="h-3 w-3" />
                  Location
                </div>
                <p className="text-xs font-medium truncate">{event.location}</p>
              </div>
            )}
            <div className="p-2 rounded-md bg-muted/30 border border-border/40">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Users className="h-3 w-3" />
                Instructors
              </div>
              <p className="text-xs font-medium">{event.requiredInstructors} needed</p>
            </div>
          </div>

          {event.description && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Description</h3>
              <p className="text-xs leading-relaxed">{event.description}</p>
            </div>
          )}

          {event.requiredSkills.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {event.requiredSkills.map(s => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded bg-muted/60 text-foreground/80">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.notes && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Notes</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{event.notes}</p>
            </div>
          )}

          {/* Opt-in section */}
          <div className="pt-2 border-t border-border/40">
            {isAssigned ? (
              <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
                <Check className="h-4 w-4" />
                You&apos;re assigned to this event
              </div>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Your preference {optIn && `(currently: ${optIn.status})`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOptIn('interested')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors min-h-[40px]',
                      optIn?.status === 'interested'
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-300'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Interested
                  </button>
                  <button
                    onClick={() => onOptIn('available')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors min-h-[40px]',
                      optIn?.status === 'available'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Available
                  </button>
                  <button
                    onClick={() => onOptIn('unavailable')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors min-h-[40px]',
                      optIn?.status === 'unavailable'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                    Can&apos;t
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Availability section ----------

function AvailabilitySection({ profileId, initialUnavailable }: {
  profileId: string
  initialUnavailable: string[]
}) {
  const qc = useQueryClient()
  const [unavailable, setUnavailable] = useState<string[]>(initialUnavailable)
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)

  const addDate = () => {
    if (!newDate) return
    if (unavailable.includes(newDate)) {
      toast.error('That date is already in your unavailable list')
      return
    }
    setUnavailable([...unavailable, newDate].sort())
    setNewDate('')
  }

  const removeDate = (date: string) => {
    setUnavailable(unavailable.filter(d => d !== date))
  }

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/profiles?id=${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unavailable }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to save')
      toast.success('Availability updated')
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = JSON.stringify(unavailable.sort()) !== JSON.stringify(initialUnavailable.sort())

  return (
    <section aria-label="My availability">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          My Availability
        </h3>
        {hasChanges && (
          <button
            onClick={save}
            disabled={saving}
            className="px-2.5 py-1 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[28px]"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-card/80 p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Add dates you can&apos;t work. The boss will see these when assigning you to events, and the scheduler will block assignments on these dates.
        </p>

        {/* Add date */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={addDate}
            disabled={!newDate}
            className="px-2.5 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground disabled:opacity-50 flex items-center gap-1 min-h-[36px]"
          >
            <Plus className="h-3 w-3" />
            Add date
          </button>
        </div>

        {/* Unavailable dates list */}
        {unavailable.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-2">
            No unavailable dates set — you&apos;re available every day.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {unavailable.map(date => (
              <span
                key={date}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]"
              >
                <Calendar className="h-2.5 w-2.5" />
                {formatPrettyDate(date)}
                <button
                  onClick={() => removeDate(date)}
                  className="ml-1 hover:text-rose-100"
                  aria-label={`Remove ${date}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function OptInButton({ active, color, onClick, icon, label }: {
  active: boolean
  color: string
  onClick: (e: React.MouseEvent) => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-md border transition-colors min-h-[32px]',
        active
          ? color
          : 'border-border/60 text-muted-foreground hover:bg-muted/40',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ---------- Claim form (shown when visiting with a token but not yet claimed) ----------

export function ClaimInviteForm({ token, onClaimed }: { token: string; onClaimed: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email) {
      toast.error('Email is required')
      return
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, email, password }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to claim')
      toast.success('Account claimed')
      onClaimed()
    } catch (e: any) {
      toast.error(e.message || 'Claim failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="h-12 w-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
            RA
          </div>
          <h1 className="text-lg font-semibold">You&apos;re invited!</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Claim your account to view the camp schedule and opt in to events.
          </p>
        </div>

        <div className="space-y-3 bg-card/80 border border-border/60 rounded-lg p-4">
          <div className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-200">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Set a password you&apos;ll remember — you&apos;ll use it with your email to log in next time.</span>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Your name (optional)
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jamie Smith"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Email (required)
            </label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Password (min 6 characters)
            </label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
              Confirm password
            </label>
            <input
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-[40px]"
          >
            {submitting ? 'Claiming…' : 'Claim my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
