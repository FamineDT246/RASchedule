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
import { ScrollArea } from '@/components/ui/scroll-area'

type EventRow = EventView & {
  _assignmentCount?: number
  _optInCount?: number
}

const HOST_COLOR_OPTIONS = ['teal', 'emerald', 'amber', 'pink', 'rose', 'slate']
const STATUS_OPTIONS = ['Draft', 'Tentative', 'Confirmed', 'Cancelled']

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
    <div className="flex-1 flex flex-col min-w-0">
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {STATUS_OPTIONS.map(status => {
            const list = grouped[status] ?? []
            if (list.length === 0) return null
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={cn('text-[11px] uppercase tracking-wide px-2 py-0.5 rounded border', EVENT_STATUS_COLOR[status])}>
                    {status}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">{list.length} event{list.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {list.map(ev => (
                    <EventListItem
                      key={ev.id}
                      event={ev}
                      onEdit={() => setEditing(ev)}
                      onDelete={() => {
                        if (confirm(`Delete "${ev.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(ev.id)
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

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
  const [form, setForm] = useState({
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
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name || !form.host) {
      toast.error('Name and host are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        code: form.code || null,
        location: form.location || null,
        description: form.description || null,
        ageRange: form.ageRange || null,
        participantCount: form.participantCount === '' ? null : Number(form.participantCount),
        specificDates: form.specificDates
          .split('\n').map(s => s.trim()).filter(Boolean)
          .map(s => s.length === 10 ? s : `${s}-2026`),
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
      <ScrollArea className="flex-1">
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
          <Field label="Specific dates (one per line, YYYY-MM-DD) — overrides the start/end range">
            <textarea value={form.specificDates} onChange={e => setForm(f => ({ ...f, specificDates: e.target.value }))} rows={3}
              placeholder="2026-07-15&#10;2026-07-17"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono" />
          </Field>
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
      </ScrollArea>
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
