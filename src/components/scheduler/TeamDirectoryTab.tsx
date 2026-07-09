'use client'

import { useQuery } from '@tanstack/react-query'
import {
  roleColor, type ProfileView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'
import { Users, Mail, Star, X, CheckCircle2 } from 'lucide-react'

type Profile = ProfileView & {
  _assignmentCount?: number
}

async function fetchProfiles(): Promise<Profile[]> {
  const r = await fetch('/api/profiles')
  if (!r.ok) throw new Error('Failed to load staff')
  return r.json()
}

const ROLE_TIERS = ['Chief', 'Senior', 'Junior', 'Assistant', 'Intern'] as const

export function TeamDirectoryTab() {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: fetchProfiles,
  })

  const grouped = (() => {
    if (!profiles) return {} as Record<string, Profile[]>
    const g: Record<string, Profile[]> = {}
    for (const p of profiles) {
      (g[p.roleTier] ?? (g[p.roleTier] = [])).push(p)
    }
    return g
  })()

  const total = profiles?.length ?? 0
  const signed = profiles?.filter(p => p.contractSigned).length ?? 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/60 bg-card/40 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Team Directory</h2>
          <p className="text-[10px] text-muted-foreground">
            {total} staff · {signed} contracts signed · {total - signed} pending
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" role="region" aria-label="Staff directory">
        <div className="p-4 space-y-6">
          {isLoading && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Loading team…
            </div>
          )}

          {ROLE_TIERS.map(tier => {
            const list = grouped[tier]
            if (!list || list.length === 0) return null
            return (
              <section key={tier} aria-labelledby={`tier-${tier}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h3
                    id={`tier-${tier}`}
                    className={cn('text-[11px] uppercase tracking-wide px-2 py-0.5 rounded border', roleColor(tier))}
                  >
                    {tier}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">{list.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map(p => (
                    <StaffCard key={p.id} profile={p} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
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
              <span
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-3 space-y-1 text-[11px]">
        {profile.available && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground shrink-0">Available:</dt>
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
