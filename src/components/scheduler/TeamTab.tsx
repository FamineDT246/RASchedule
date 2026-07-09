'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  roleColor,
  type ProfileView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, X, Save, User, CheckCircle2, AlertCircle,
  LayoutGrid, List, Star, Calendar,
} from 'lucide-react'
import { Accordion } from './Accordion'

type Profile = ProfileView & {
  _assignmentCount?: number
}

async function fetchProfiles(): Promise<Profile[]> {
  const r = await fetch('/api/profiles')
  if (!r.ok) throw new Error('Failed to load staff')
  return r.json()
}

const ROLE_TIERS = ['Chief', 'Senior', 'Junior', 'Assistant', 'Intern'] as const

export function TeamTab() {
  const qc = useQueryClient()
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: fetchProfiles,
  })
  const [viewMode, setViewMode] = useState<'directory' | 'edit'>('directory')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Failed to delete')
      }
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles-list'] })
      qc.invalidateQueries({ queryKey: ['schedule'] })
      toast.success('Staff member removed')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  })

  const handleDelete = (profile: Profile) => {
    toast(`Remove ${profile.name}?`, {
      description: 'Their assignments will also be removed. This cannot be undone.',
      duration: 8000,
      action: {
        label: 'Remove',
        onClick: () => deleteMutation.mutate(profile.id),
      },
    })
  }

  const grouped = useMemo(() => {
    if (!profiles) return {} as Record<string, Profile[]>
    const g: Record<string, Profile[]> = {}
    for (const p of profiles) {
      (g[p.roleTier] ?? (g[p.roleTier] = [])).push(p)
    }
    return g
  }, [profiles])

  const total = profiles?.length ?? 0
  const signed = profiles?.filter(p => p.contractSigned).length ?? 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-card/40 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Team</h2>
          <p className="text-[10px] text-muted-foreground">
            {total} staff · {signed} contracts signed · {total - signed} pending
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View toggle */}
          <div className="flex rounded-md border border-border/60 overflow-hidden">
            <button
              onClick={() => setViewMode('directory')}
              className={cn(
                'px-2.5 py-1.5 text-xs flex items-center gap-1 min-h-[32px]',
                viewMode === 'directory'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              aria-pressed={viewMode === 'directory'}
              title="Directory view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Directory</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={cn(
                'px-2.5 py-1.5 text-xs flex items-center gap-1 min-h-[32px] border-l border-border/60',
                viewMode === 'edit'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              aria-pressed={viewMode === 'edit'}
              title="Edit view"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>
          {viewMode === 'edit' && (
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5 min-h-[32px]"
            >
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">Add staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" role="region" aria-label="Team directory">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading team…</p>
        )}

        {viewMode === 'directory' ? (
          <DirectoryView grouped={grouped} />
        ) : (
          <EditView grouped={grouped} onEdit={p => setEditing(p)} onDelete={handleDelete} />
        )}
      </div>

      {(editing || creating) && (
        <StaffEditDrawer
          profile={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => {
            setEditing(null)
            setCreating(false)
            qc.invalidateQueries({ queryKey: ['profiles-list'] })
            qc.invalidateQueries({ queryKey: ['schedule'] })
          }}
        />
      )}
    </div>
  )
}

// ---------- Directory (read-only card grid) ----------

function DirectoryView({ grouped }: { grouped: Record<string, Profile[]> }) {
  return (
    <div className="p-4 space-y-3">
      {ROLE_TIERS.map(tier => {
        const list = grouped[tier]
        if (!list || list.length === 0) return null
        return (
          <Accordion
            key={tier}
            label={tier}
            count={list.length}
            labelClassName={roleColor(tier)}
            defaultOpen={tier === 'Chief' || tier === 'Senior'}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {list.map(p => <StaffCard key={p.id} profile={p} />)}
            </div>
          </Accordion>
        )
      })}
    </div>
  )
}

function StaffCard({ profile }: { profile: Profile }) {
  const initials = profile.name.split(' ').map(n => n[0]).slice(0, 2).join('')
  return (
    <article
      className="rounded-lg border border-border/60 bg-card/80 p-4 hover:shadow-md hover:border-foreground/30 transition-all"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-semibold flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold truncate">{profile.name}</h4>
            {profile.contractSigned ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" aria-label="Contract signed" />
            ) : (
              <span
                className="h-2 w-2 rounded-full bg-amber-400 shrink-0"
                title="Contract not signed"
                aria-label="Contract not signed"
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{profile.role}</p>
        </div>
      </div>

      {profile.skillsList.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
            <Star className="h-2.5 w-2.5" />
            Skills
          </div>
          <div className="flex flex-wrap gap-1">
            {profile.skillsList.map(s => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground/80">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-3 space-y-1 text-[11px]">
        {profile.available && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground shrink-0 flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              Available:
            </dt>
            <dd className="text-foreground/90">{profile.available}</dd>
          </div>
        )}
        {profile.unavailableList.length > 0 && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground shrink-0 flex items-center gap-0.5">
              <X className="h-2.5 w-2.5" />
              Unavailable:
            </dt>
            <dd className="text-rose-300">{profile.unavailableList.length} date{profile.unavailableList.length > 1 ? 's' : ''}</dd>
          </div>
        )}
        {profile.notes && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground shrink-0">Notes:</dt>
            <dd className="text-foreground/80 line-clamp-2">{profile.notes}</dd>
          </div>
        )}
      </dl>
    </article>
  )
}

// ---------- Edit (list with edit/delete buttons) ----------

function EditView({ grouped, onEdit, onDelete }: {
  grouped: Record<string, Profile[]>
  onEdit: (p: Profile) => void
  onDelete: (p: Profile) => void
}) {
  return (
    <div className="p-4 space-y-3">
      {ROLE_TIERS.map(tier => {
        const list = grouped[tier]
        if (!list || list.length === 0) return null
        return (
          <Accordion
            key={tier}
            label={tier}
            count={list.length}
            labelClassName={roleColor(tier)}
            defaultOpen={tier === 'Chief' || tier === 'Senior'}
          >
            <div className="space-y-1.5 pt-2">
              {list.map(p => (
                <StaffRow key={p.id} profile={p} onEdit={() => onEdit(p)} onDelete={() => onDelete(p)} />
              ))}
            </div>
          </Accordion>
        )
      })}
    </div>
  )
}

function StaffRow({ profile, onEdit, onDelete }: {
  profile: Profile
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 p-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
        {profile.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{profile.name}</p>
          {!profile.contractSigned && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Contract not signed" />
          )}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {profile.role}
          {profile.skillsList.length > 0 && ` · ${profile.skillsList.slice(0, 3).join(', ')}${profile.skillsList.length > 3 ? ` +${profile.skillsList.length - 3}` : ''}`}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label={`Edit ${profile.name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label={`Remove ${profile.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ---------- Edit Drawer ----------

function StaffEditDrawer({ profile, onClose, onSaved }: {
  profile: Profile | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!profile
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    sex: profile?.sex ?? '',
    role: profile?.role ?? '',
    roleTier: profile?.roleTier ?? 'Junior',
    skills: (profile?.skillsList ?? []).join(', '),
    available: profile?.available ?? '',
    unavailable: (profile?.unavailableList ?? []).join('\n'),
    contractSigned: profile?.contractSigned ?? false,
    notes: profile?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name || !form.role) {
      toast.error('Name and role are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        sex: form.sex || null,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        available: form.available || null,
        unavailable: form.unavailable
          .split('\n').map(s => s.trim()).filter(Boolean)
          .map(s => s.length === 10 ? s : `${s}-2026`),
        notes: form.notes || null,
      }
      const url = isEdit ? `/api/profiles?id=${profile!.id}` : '/api/profiles'
      const method = isEdit ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to save')
      toast.success(isEdit ? 'Staff updated' : 'Staff added')
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="absolute inset-y-0 right-0 z-30 w-full sm:w-[28rem] shadow-2xl border-l border-border/60 bg-card/95 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? `Edit ${profile?.name}` : 'Add new staff member'}
    >
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <User className="h-4 w-4" />
          {isEdit ? 'Edit staff' : 'New staff'}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" role="region" aria-label="Staff details form">
        <div className="p-4 space-y-3">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-required="true"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Sex">
              <select
                value={form.sex}
                onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Role tier">
              <select
                value={form.roleTier}
                onChange={e => setForm(f => ({ ...f, roleTier: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {ROLE_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Role (full title)" required>
            <input
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              placeholder="e.g. Senior Instructor"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-required="true"
            />
          </Field>
          <Field label="Skills (comma-separated)">
            <input
              value={form.skills}
              onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              placeholder="Robotics, Coding, CAD"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </Field>
          <Field label="Availability window">
            <input
              value={form.available}
              onChange={e => setForm(f => ({ ...f, available: e.target.value }))}
              placeholder="e.g. July, August"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </Field>
          <Field label="Unavailable dates (one per line, YYYY-MM-DD)">
            <textarea
              value={form.unavailable}
              onChange={e => setForm(f => ({ ...f, unavailable: e.target.value }))}
              rows={4}
              placeholder="2026-07-09&#10;2026-07-11"
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/40">
            <input
              type="checkbox"
              checked={form.contractSigned}
              onChange={e => setForm(f => ({ ...f, contractSigned: e.target.checked }))}
              className="h-4 w-4 rounded accent-emerald-500"
            />
            <span className="text-sm flex items-center gap-1.5">
              {form.contractSigned ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              )}
              Contract signed
            </span>
          </label>
        </div>
      </div>

      <div className="p-3 border-t border-border/60 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[36px]"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5 disabled:opacity-50 min-h-[36px]"
        >
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
