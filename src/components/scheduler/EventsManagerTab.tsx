'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  hostColor, EVENT_STATUS_COLOR, formatShortDate, formatTime,
  type EventView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, X, Calendar, Clock, Users, MapPin, Tag, Save, AlertCircle,
} from 'lucide-react'
import { Accordion } from './Accordion'

type EventRow = EventView & {
  _assignmentCount?: number
  _optInCount?: number
}

const HOST_COLOR_OPTIONS = ['teal', 'emerald', 'amber', 'pink', 'rose', 'slate']
const STATUS_OPTIONS = ['Draft', 'Tentative', 'Confirmed', 'Cancelled', 'Archived']

async function fetchEvents(): Promise<EventRow[]> {
  const r = await fetch('/api/events')
  if (!r.ok) throw new Error('Failed to load events')
  const data = await r.json()
  return data.map((e: any) => ({
    ...e,
    specificDatesList: e.specificDatesList ?? (e.specificDates ? e.specificDates.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
  }))
}

export function EventsManagerTab() {
  const qc = useQueryClient()
  const { data: events, isLoading } = useQuery({ queryKey: ['events'], queryFn: fetchEvents })
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [creating, setCreating] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Event deleted')
    },
    onError: () => toast.error('Failed to delete event'),
  })

  const grouped = useMemo(() => {
    if (!events) return { Confirmed: [], Tentative: [], Draft: [], Cancelled: [] } as Record<string, EventRow[]>
    const g: Record<string, EventRow[]> = { Confirmed: [], Tentative: [], Draft: [], Cancelled: [] }
    for (const e of events) {
      (g[e.status] ?? (g[e.status] = [])).push(e)
    }
    return g
  }, [events])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border/60 bg-card/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Event Management</h2>
          <p className="text-[10px] text-muted-foreground">
            Set status, dates, and required instructor counts. Draft events don&apos;t appear on the calendar.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5"
        >
          <Plus className="h-3 w-3" />
          New event
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" role="region" aria-label="Events list">
        <div className="p-4 space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {STATUS_OPTIONS.map(status => {
            const list = grouped[status] ?? []
            if (list.length === 0) return null
            return (
              <Accordion
                key={status}
                label={status}
                count={list.length}
                labelClassName={EVENT_STATUS_COLOR[status]}
                defaultOpen={status === 'Draft' || status === 'Archived'}
              >
                {list.map(ev => (
                  <EventListItem
                    key={ev.id}
                    event={ev}
                    onEdit={() => setEditing(ev)}
                    onDelete={() => {
                      toast(`Delete "${ev.name}"?`, {
                        description: 'This cannot be undone.',
                        duration: 8000,
                        action: {
                          label: 'Delete',
                          onClick: () => deleteMutation.mutate(ev.id),
                        },
                      })
                    }}
                  />
                ))}
              </Accordion>
            )
          })}
        </div>
      </div>

      {(editing || creating) && (
        <EventEditDrawer
          event={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => {
            setEditing(null)
            setCreating(false)
            qc.invalidateQueries({ queryKey: ['events'] })
            qc.invalidateQueries({ queryKey: ['schedule'] })
          }}
        />
      )}
    </div>
  )
}

function EventListItem({ event, onEdit, onDelete }: {
  event: EventRow
  onEdit: () => void
  onDelete: () => void
}) {
  const colors = hostColor(event.hostColor)
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3 flex items-center gap-3">
      <div className={cn('h-10 w-1 rounded-full shrink-0', colors.bar)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{event.name}</p>
          {event.code && <span className="text-[10px] text-muted-foreground">{event.code}</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
          <span className={cn('px-1.5 py-0.5 rounded border', colors.chip)}>{event.host}</span>
          <span className="flex items-center gap-0.5">
            <Calendar className="h-2.5 w-2.5" />
            {formatShortDate(event.startDate)}{event.endDate !== event.startDate && ` – ${formatShortDate(event.endDate)}`}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatTime(event.startTime)}
          </span>
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {event._assignmentCount ?? 0}/{event.requiredInstructors}
          </span>
          {event._optInCount && event._optInCount > 0 && (
            <span className="text-emerald-400">+{event._optInCount} opt-in{event._optInCount > 1 ? 's' : ''}</span>
          )}
          {event.specificDatesList && event.specificDatesList.length > 0 && (
            <span className="text-teal-300">
              {event.specificDatesList.length} specific date{event.specificDatesList.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function EventEditDrawer({ event, onClose, onSaved }: {
  event: EventRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!event
  const [form, setForm] = useState(() => ({
    code: event?.code ?? '',
    name: event?.name ?? '',
    host: event?.host ?? '',
    hostColor: event?.hostColor ?? 'slate',
    location: event?.location ?? '',
    description: event?.description ?? '',
    status: event?.status ?? 'Draft',
    startDate: event?.startDate ?? '2026-07-06',
    endDate: event?.endDate ?? '2026-07-10',
    startTime: event?.startTime ?? '09:00',
    endTime: event?.endTime ?? '15:00',
    requiredInstructors: event?.requiredInstructors ?? 2,
    ageRange: event?.ageRange ?? '',
    participantCount: event?.participantCount ?? '',
    specificDates: (event?.specificDatesList ?? []).join('\n'),
    notes: event?.notes ?? '',
    skills: (event?.requiredSkills ?? []).join(', '),
    // Recurrence fields
    recurring: false,
    recurringDays: [] as number[], // 0=Mon .. 6=Sun
    recurringWeeks: 6,
  }))
  const [saving, setSaving] = useState(false)

  // Generate preview dates from recurrence pattern
  const recurringPreview = useMemo(() => {
    if (!form.recurring || form.recurringDays.length === 0 || !form.startDate) return []
    const dates: string[] = []
    const start = new Date(`${form.startDate}T00:00:00.000Z`)
    // Find the first matching day on or after startDate
    let cursor = new Date(start)
    // Walk forward up to recurringWeeks * 7 days to find all matching days
    const maxDays = form.recurringWeeks * 7 + 7
    for (let i = 0; i < maxDays; i++) {
      const dayOfWeek = cursor.getUTCDay() // 0=Sun .. 6=Sat
      // Convert to Monday-based: 0=Mon .. 6=Sun
      const mondayBased = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      if (form.recurringDays.includes(mondayBased)) {
        dates.push(cursor.toISOString().slice(0, 10))
      }
      if (dates.length >= form.recurringWeeks) break
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return dates
  }, [form.recurring, form.recurringDays, form.recurringWeeks, form.startDate])

  const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const toggleRecurringDay = (day: number) => {
    setForm(f => ({
      ...f,
      recurringDays: f.recurringDays.includes(day)
        ? f.recurringDays.filter(d => d !== day)
        : [...f.recurringDays, day].sort(),
    }))
  }

  const save = async () => {
    if (!form.name || !form.host) {
      toast.error('Name and host are required')
      return
    }
    setSaving(true)
    try {
      // If recurring is on, use the generated dates as specificDates and ignore manual entry
      const specificDates = form.recurring
        ? recurringPreview
        : form.specificDates
            .split('\n').map(s => s.trim()).filter(Boolean)
            .map(s => s.length === 10 ? s : `${s}-2026`)

      const payload = {
        code: form.code || null,
        name: form.name,
        host: form.host,
        hostColor: form.hostColor,
        location: form.location || null,
        description: form.description || null,
        status: form.status,
        startDate: form.startDate,
        endDate: form.recurring && recurringPreview.length > 0
          ? recurringPreview[recurringPreview.length - 1]
          : form.endDate,
        startTime: form.startTime,
        endTime: form.endTime,
        requiredInstructors: form.requiredInstructors,
        ageRange: form.ageRange || null,
        participantCount: form.participantCount === '' ? null : Number(form.participantCount),
        specificDates,
        notes: form.notes || null,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      }
      const url = isEdit ? `/api/events?id=${event!.id}` : '/api/events'
      const method = isEdit ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Failed to save')
      }
      toast.success(isEdit ? 'Event updated' : 'Event created')
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-[28rem] shadow-2xl border-l border-border/60 bg-card/95 backdrop-blur-md flex flex-col">
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{isEdit ? 'Edit event' : 'New event'}</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" role="region" aria-label="Event details form">
        <div className="p-4 space-y-3">
          <Field label="Name" required>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Code">
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Host" required>
              <input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
            <Field label="Host color">
              <select value={form.hostColor} onChange={e => setForm(f => ({ ...f, hostColor: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400">
                {HOST_COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Location">
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start date">
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
            <Field label="End date">
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start time">
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
            <Field label="End time">
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Required instructors">
              <input type="number" min={1} value={form.requiredInstructors} onChange={e => setForm(f => ({ ...f, requiredInstructors: Number(e.target.value) }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
            <Field label="Participants">
              <input type="number" value={form.participantCount} onChange={e => setForm(f => ({ ...f, participantCount: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
            </Field>
          </div>
          <Field label="Age range">
            <input value={form.ageRange} onChange={e => setForm(f => ({ ...f, ageRange: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </Field>
          {/* Recurring event toggle */}
          <div className="border border-border/60 rounded-md p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              <span className="text-sm font-medium">Recurring event</span>
              <span className="text-[10px] text-muted-foreground">
                (e.g. every Tuesday for 6 weeks)
              </span>
            </label>

            {form.recurring && (
              <div className="space-y-3 pl-6 border-l-2 border-emerald-500/30">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                    Repeats on
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAY_LABELS.map((wd, idx) => (
                      <button
                        key={wd}
                        type="button"
                        onClick={() => toggleRecurringDay(idx)}
                        className={cn(
                          'px-2.5 py-1.5 text-xs rounded-md border min-w-[36px] min-h-[36px] transition-colors',
                          form.recurringDays.includes(idx)
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                            : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                        )}
                        aria-pressed={form.recurringDays.includes(idx)}
                      >
                        {wd}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Starting from">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </Field>
                  <Field label="For N weeks">
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={form.recurringWeeks}
                      onChange={e => setForm(f => ({ ...f, recurringWeeks: Number(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </Field>
                </div>

                {recurringPreview.length > 0 ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                      Preview — {recurringPreview.length} date{recurringPreview.length > 1 ? 's' : ''} will be generated
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-md border border-border/40">
                      {recurringPreview.map(d => (
                        <span
                          key={d}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground italic">
                    Select at least one weekday above to see the preview.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual specific dates — hidden when recurring is on */}
          {!form.recurring && (
            <Field label="Specific dates (one per line, YYYY-MM-DD) — overrides the start/end range">
              <textarea value={form.specificDates} onChange={e => setForm(f => ({ ...f, specificDates: e.target.value }))} rows={3}
                placeholder="2026-07-15&#10;2026-07-17"
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono" />
            </Field>
          )}
          <Field label="Skills (comma-separated, informational only)">
            <input value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
          </Field>

          {form.status === 'Draft' && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-zinc-500/10 border border-zinc-500/30 text-[10px] text-zinc-300">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Draft events do not appear on the calendar. Set status to Tentative or Confirmed when dates are firm.</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-3 border-t border-border/60 flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground">
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5 disabled:opacity-50">
          <Save className="h-3 w-3" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
