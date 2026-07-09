'use client'

import { useMemo, useState } from 'react'
import { DraggableInstructor } from './DraggableInstructor'
import type { ProfileView } from '@/lib/scheduler-types'
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { roleColor } from '@/lib/scheduler-types'

type Props = {
  profiles: ProfileView[]
  collapsed: boolean
  onToggleCollapsed: () => void
}

const ROLE_TIERS = ['Chief', 'Senior', 'Junior', 'Assistant', 'Intern'] as const

export function RosterRail({ profiles, collapsed, onToggleCollapsed }: Props) {
  const [query, setQuery] = useState('')
  const [activeTiers, setActiveTiers] = useState<Set<string>>(new Set())
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set())

  const allSkills = useMemo(() => {
    const s = new Set<string>()
    profiles.forEach(p => p.skillsList.forEach(x => s.add(x)))
    return Array.from(s).sort()
  }, [profiles])

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false
      if (activeTiers.size && !activeTiers.has(p.roleTier)) return false
      if (activeSkills.size && !p.skillsList.some(s => activeSkills.has(s))) return false
      return true
    })
  }, [profiles, query, activeTiers, activeSkills])

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-border/60 bg-card/40 flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground"
          title="Expand roster"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="text-[10px] text-muted-foreground -rotate-90 mt-4 whitespace-nowrap">
          {filtered.length} staff
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-72 shrink-0 border-r border-border/60 bg-card/40 flex flex-col">
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Roster</h2>
          <p className="text-[10px] text-muted-foreground">{filtered.length} of {profiles.length} staff</p>
        </div>
        <button
          onClick={onToggleCollapsed}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          title="Collapse roster"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-2 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name..."
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Filter className="h-2.5 w-2.5" /> Role
          </div>
          <div className="flex flex-wrap gap-1">
            {ROLE_TIERS.map(t => (
              <button
                key={t}
                onClick={() => {
                  const next = new Set(activeTiers)
                  if (next.has(t)) next.delete(t); else next.add(t)
                  setActiveTiers(next)
                }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                  activeTiers.has(t)
                    ? roleColor(t)
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Filter className="h-2.5 w-2.5" /> Skill
          </div>
          <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1 pr-1">
            {allSkills.map(s => (
              <button
                key={s}
                onClick={() => {
                  const next = new Set(activeSkills)
                  if (next.has(s)) next.delete(s); else next.add(s)
                  setActiveSkills(next)
                }}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                  activeSkills.has(s)
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {(activeTiers.size > 0 || activeSkills.size > 0 || query) && (
          <button
            onClick={() => { setQuery(''); setActiveTiers(new Set()); setActiveSkills(new Set()) }}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.map(p => (
          <DraggableInstructor key={p.id} profile={p} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-xs text-muted-foreground p-6">
            No staff match the filters.
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border/60 text-[10px] text-muted-foreground text-center">
        Drag a card onto an event
      </div>
    </aside>
  )
}
