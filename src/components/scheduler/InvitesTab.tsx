'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Copy, Trash2, CheckCircle2, Clock, Link as LinkIcon, X, MessageCircle, Mail } from 'lucide-react'

type Invite = {
  id: string
  name: string
  email: string | null
  role: string
  profileId: string | null
  profileName: string | null
  inviteToken: string
  claimedAt: string | null
  inviteExpiresAt: string | null
  createdAt: string
}

type Profile = {
  id: string
  name: string
  role: string
  roleTier: string
}

async function fetchInvites(): Promise<Invite[]> {
  const r = await fetch('/api/invites')
  if (!r.ok) throw new Error('Failed to load invites')
  return r.json()
}

async function fetchProfiles(): Promise<Profile[]> {
  const r = await fetch('/api/profiles')
  if (!r.ok) throw new Error('Failed to load profiles')
  return r.json()
}

function inviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/?token=${token}`
  return `${window.location.origin}/?token=${token}`
}

export function InvitesTab() {
  const qc = useQueryClient()
  const { data: invites } = useQuery({ queryKey: ['invites'], queryFn: fetchInvites })
  const { data: profiles } = useQuery({ queryKey: ['profiles-list'], queryFn: fetchProfiles })
  const [showCreate, setShowCreate] = useState(false)

  const createMutation = useMutation({
    mutationFn: async (args: { name: string; profileId?: string }) => {
      const r = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed to create invite')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] })
      toast.success('Invite created')
      setShowCreate(false)
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create invite'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/invites?id=${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed to delete')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] })
      toast.success('Invite revoked')
    },
    onError: () => toast.error('Failed to revoke invite'),
  })

  const copyLink = async (token: string) => {
    const url = inviteUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied', { description: url })
    } catch {
      toast.error('Could not copy — copy manually', { description: url })
    }
  }

  const shareWhatsApp = (token: string, name: string) => {
    const url = inviteUrl(token)
    const msg = `Hi ${name}! You're invited to join the RA Syncbot camp scheduler. Click here to claim your account and see the camp schedule:\n\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  const shareEmail = (token: string, name: string) => {
    const url = inviteUrl(token)
    const subject = 'Your RA Syncbot scheduler invite'
    const body = `Hi ${name},\n\nYou're invited to join the RA Syncbot camp scheduler. Click the link below to claim your account and see the camp schedule:\n\n${url}\n\nOnce you claim your account, you'll be able to opt in to events you'd like to work and see your assignments.\n\nThanks!`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="p-4 border-b border-border/60 bg-card/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Instructor Invites</h2>
          <p className="text-[10px] text-muted-foreground">
            Generate a personal link for each instructor. They can opt in to events and view their schedule — nothing else.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5"
        >
          <Plus className="h-3 w-3" />
          New invite
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" role="region" aria-label="Invites list">
        <div className="p-4 space-y-2">
          {invites?.length === 0 && (
            <div className="text-center p-8 text-sm text-muted-foreground">
              No invites yet. Click <strong>New invite</strong> to generate one for an instructor.
            </div>
          )}
          {invites?.map(inv => (
            <div key={inv.id} className="rounded-lg border border-border/60 bg-card/80 p-3 flex items-center gap-3">
              <div className={cn(
                'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
                inv.claimedAt
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300',
              )}>
                {inv.claimedAt ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{inv.name}</p>
                  {inv.profileName && (
                    <span className="text-[10px] text-muted-foreground">
                      linked to {inv.profileName}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {inv.email ?? 'No email set'}
                  {' · '}
                  {inv.claimedAt
                    ? `claimed ${new Date(inv.claimedAt).toLocaleDateString('en-US', { timeZone: 'America/Barbados' })}`
                    : 'pending claim'}
                </div>
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <code className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                    {inviteUrl(inv.inviteToken)}
                  </code>
                  <button
                    onClick={() => copyLink(inv.inviteToken)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground min-w-[28px] min-h-[28px] flex items-center justify-center"
                    title="Copy link"
                    aria-label="Copy invite link"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {!inv.claimedAt && (
                    <>
                      <button
                        onClick={() => shareWhatsApp(inv.inviteToken, inv.name)}
                        className="p-1.5 rounded hover:bg-emerald-500/15 hover:text-emerald-300 text-muted-foreground min-w-[28px] min-h-[28px] flex items-center justify-center"
                        title="Share via WhatsApp"
                        aria-label={`Share ${inv.name}'s invite via WhatsApp`}
                      >
                        <MessageCircle className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => shareEmail(inv.inviteToken, inv.name)}
                        className="p-1.5 rounded hover:bg-sky-500/15 hover:text-sky-300 text-muted-foreground min-w-[28px] min-h-[28px] flex items-center justify-center"
                        title="Share via email"
                        aria-label={`Share ${inv.name}'s invite via email`}
                      >
                        <Mail className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  toast(`Revoke invite for ${inv.name}?`, {
                    description: 'They will lose access immediately.',
                    duration: 8000,
                    action: {
                      label: 'Revoke',
                      onClick: () => deleteMutation.mutate(inv.id),
                    },
                  })
                }}
                className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Revoke invite"
                aria-label={`Revoke invite for ${inv.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateInviteDrawer
          profiles={profiles ?? []}
          invitedProfileIds={new Set(invites?.map(i => i.profileId).filter(Boolean) as string[])}
          onClose={() => setShowCreate(false)}
          onCreate={(name, profileId) => createMutation.mutate({ name, profileId })}
          creating={createMutation.isPending}
        />
      )}
    </div>
  )
}

function CreateInviteDrawer({ profiles, invitedProfileIds, onClose, onCreate, creating }: {
  profiles: Profile[]
  invitedProfileIds: Set<string>
  onClose: () => void
  onCreate: (name: string, profileId?: string) => void
  creating: boolean
}) {
  // Filter out staff who already have invites linked
  const available = profiles.filter(p => !invitedProfileIds.has(p.id))
  const [profileId, setProfileId] = useState<string>(available[0]?.id ?? '')

  const canCreate = !!profileId

  const submit = () => {
    const p = profiles.find(p => p.id === profileId)
    if (p) onCreate(p.name, p.id)
  }

  return (
    <div
      className="absolute inset-y-0 right-0 z-30 w-full sm:w-96 shadow-2xl border-l border-border/60 bg-card/95 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Create new invite"
    >
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold">New invite</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {available.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              All staff members already have invites.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Add new staff in the Team tab first, then come back to create their invite.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                Staff member
              </label>
              <select
                value={profileId}
                onChange={e => setProfileId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {available.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.roleTier}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-2">
                The instructor will be linked to this staff profile, so their assignments show up in the scheduler.
              </p>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-200">
              <LinkIcon className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                After creating the invite, copy the link and send it to the instructor via WhatsApp or email.
                They&apos;ll be asked to set their email, then they can opt in to events.
              </span>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/40 text-[10px] text-muted-foreground">
              <span>
                Need to add a new instructor? Go to the <strong>Team</strong> tab, switch to <strong>Edit</strong> mode, and click <strong>Add staff</strong>.
              </span>
            </div>
          </>
        )}
      </div>
      <div className="p-3 border-t border-border/60 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs rounded-md border border-border/60 hover:bg-muted text-muted-foreground min-h-[36px]"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canCreate || creating || available.length === 0}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1.5 min-h-[36px]"
        >
          <Plus className="h-3 w-3" />
          {creating ? 'Creating…' : 'Create invite'}
        </button>
      </div>
    </div>
  )
}
