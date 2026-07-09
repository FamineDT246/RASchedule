'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  hostColor, formatTime, formatPrettyDate, formatShortDate,
  EVENT_STATUS_COLOR, type EventView, type AssignmentView, type AuthUser,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Calendar, Clock, MapPin, Users, Check, X, Star, AlertCircle, Shield, Shirt,
} from 'lucide-react'

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

export function InstructorView({ user }: { user: AuthUser }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['schedule'], queryFn: fetchSchedule })
  const { data: optIns } = useQuery({ queryKey: ['my-opt-ins'], queryFn: fetchMyOptIns })

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
    <div className="flex-1 flex flex-col min-w-0">
      <div className="p-4 border-b border-border/60 bg-card/40">
        <h2 className="text-sm font-semibold">
          Hi {user.name.split(' ')[0]} — here&apos;s your schedule
        </h2>
        <p className="text-[10px] text-muted-foreground">
          Opt in to events you&apos;d like to work. {user.profile ? 'The boss will see your preferences when assigning.' : 'No staff profile linked — ask the boss to link one.'}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 grid gap-6 lg:grid-cols-2">
          {/* My schedule */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              My assignments ({myAssignments.length})
            </h3>
            <div className="space-y-2">
              {myAssignments.length === 0 && (
                <div className="text-xs text-muted-foreground p-4 border border-dashed border-border/60 rounded-md text-center">
                  {user.profile
                    ? 'You have no assignments yet. Opt in to events below to let the boss know you\'re interested.'
                    : 'No staff profile linked. Ask the boss to link your account to a staff profile so you can be assigned.'}
                </div>
              )}
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
                    <div className={cn('h-10 w-1 rounded-full shrink-0', colors.bar)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{ev.name}</p>
                        {a.isAlternative && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-0.5">
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
                          {formatTime(ev.startTime)} – {formatTime(ev.endTime)}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {a.shirtColor && (
                      <div className="shrink-0 text-right">
                        <div className="text-[9px] text-muted-foreground uppercase">Shirt</div>
                        <div className="text-xs font-medium">{a.shirtColor}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Opt-in list */}
          <section>
            <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Star className="h-3 w-3" />
              Events you can opt in to ({optableEvents.length})
            </h3>
            <div className="space-y-2">
              {optableEvents.length === 0 && (
                <div className="text-xs text-muted-foreground p-4 border border-dashed border-border/60 rounded-md text-center">
                  No events available for opt-in right now.
                </div>
              )}
              {optableEvents.map(ev => {
                const colors = hostColor(ev.hostColor)
                const optIn = optIns?.[ev.id]
                const isAssigned = myAssignments.some(a => a.eventId === ev.id)
                return (
                  <div key={ev.id} className="rounded-lg border border-border/60 bg-card/80 p-3">
                    <div className="flex items-start gap-2">
                      <div className={cn('h-8 w-1 rounded-full shrink-0 mt-1', colors.bar)} />
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
                        {ev.location && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {ev.location}
                          </div>
                        )}
                        {ev.description && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{ev.description}</p>
                        )}
                      </div>
                    </div>

                    {isAssigned ? (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                        <Check className="h-3 w-3" />
                        You&apos;re assigned to this event
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-1.5">
                        <OptInButton
                          active={optIn?.status === 'interested'}
                          color="active:bg-teal-500/20 bg-teal-500/10 text-teal-300 border-teal-500/40"
                          onClick={() => optInMutation.mutate({ eventId: ev.id, status: 'interested' })}
                          icon={<Star className="h-3 w-3" />}
                          label="Interested"
                        />
                        <OptInButton
                          active={optIn?.status === 'available'}
                          color="active:bg-emerald-500/20 bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                          onClick={() => optInMutation.mutate({ eventId: ev.id, status: 'available' })}
                          icon={<Check className="h-3 w-3" />}
                          label="Available"
                        />
                        <OptInButton
                          active={optIn?.status === 'unavailable'}
                          color="active:bg-rose-500/20 bg-rose-500/10 text-rose-300 border-rose-500/40"
                          onClick={() => optInMutation.mutate({ eventId: ev.id, status: 'unavailable' })}
                          icon={<X className="h-3 w-3" />}
                          label="Can&apos;t make it"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}

function OptInButton({ active, color, onClick, icon, label }: {
  active: boolean
  color: string
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded-md border transition-colors',
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
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email) {
      toast.error('Email is required')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, email }),
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
            <span>Use the same email each time you log in. Your invite link is your login link too.</span>
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
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? 'Claiming…' : 'Claim my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
