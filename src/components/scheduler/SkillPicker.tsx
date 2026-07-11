'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillItem } from '@/lib/scheduler-types'

async function fetchSkills(): Promise<SkillItem[]> {
  const r = await fetch('/api/skills')
  if (!r.ok) return []
  return r.json()
}

type Props = {
  selected: string[]
  onChange: (skills: string[]) => void
  /** If true, show a "Manage catalog" section with delete buttons (admin only) */
  allowCatalogManagement?: boolean
  label?: string
  placeholder?: string
}

/**
 * Skill picker with reusable catalog.
 * - Type to search existing skills
 * - Click a skill to add it
 * - Click "Add new skill" to create one in the catalog
 * - X button on each chip to remove
 * - (Admin) Trash icon to delete from catalog entirely
 */
export function SkillPicker({ selected, onChange, allowCatalogManagement = false, label = 'Skills', placeholder = 'Search skills…' }: Props) {
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCatalogManager, setShowCatalogManager] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: skills } = useQuery({ queryKey: ['skills'], queryFn: fetchSkills })

  const createSkill = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create skill'),
  })

  const deleteSkill = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/skills?id=${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['skills'] })
      toast.success('Skill removed from catalog')
    },
    onError: () => toast.error('Failed to delete skill'),
  })

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = (skills ?? []).filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) && !selected.includes(s.name)
  )

  const exactMatch = (skills ?? []).some(s => s.name.toLowerCase() === query.toLowerCase().trim())
  const canCreateNew = query.trim().length > 0 && !exactMatch && !selected.includes(query.trim())

  const addSkill = (name: string) => {
    if (!selected.includes(name)) {
      onChange([...selected, name])
    }
    setQuery('')
    setShowDropdown(false)
  }

  const removeSkill = (name: string) => {
    onChange(selected.filter(s => s !== name))
  }

  return (
    <div className="space-y-2" ref={ref}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {allowCatalogManagement && (
          <button
            type="button"
            onClick={() => setShowCatalogManager(s => !s)}
            className="text-[10px] text-emerald-300 hover:text-emerald-200"
          >
            {showCatalogManager ? 'Hide catalog' : 'Manage catalog'}
          </button>
        )}
      </div>

      {/* Selected skills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-foreground/90 text-[11px] border border-border/40"
            >
              {s}
              <button
                type="button"
                onClick={() => removeSkill(s)}
                className="hover:text-rose-300"
                aria-label={`Remove ${s}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            // Delay so item clicks register before the dropdown closes
            setTimeout(() => setShowDropdown(false), 150)
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setShowDropdown(false)
              setQuery('')
            }
          }}
          placeholder={placeholder}
          className="w-full px-2 py-1.5 text-sm rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        {showDropdown && (filtered.length > 0 || canCreateNew) && (
          <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-card border border-border/60 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filtered.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => addSkill(s.name)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/40 flex items-center justify-between"
              >
                <span>{s.name}</span>
                <Plus className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
            {canCreateNew && (
              <button
                type="button"
                onClick={() => {
                  createSkill.mutate(query.trim(), {
                    onSuccess: () => addSkill(query.trim()),
                  })
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-500/10 text-emerald-300 flex items-center justify-between border-t border-border/40"
              >
                <span>Create "{query.trim()}"</span>
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Catalog manager (admin) */}
      {allowCatalogManagement && showCatalogManager && (
        <div className="rounded-md border border-border/40 bg-muted/20 p-2 max-h-40 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1.5">
            All skills in catalog ({(skills ?? []).length})
          </p>
          {(skills ?? []).length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No skills in catalog yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {(skills ?? []).map(s => (
                <span
                  key={s.id}
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border',
                    selected.includes(s.name)
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-muted/60 text-foreground/80 border-border/40',
                  )}
                >
                  {s.name}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove "${s.name}" from the catalog? This won't affect existing assignments.`)) {
                        deleteSkill.mutate(s.id)
                      }
                    }}
                    className="hover:text-rose-300"
                    aria-label={`Delete ${s.name} from catalog`}
                    title="Remove from catalog"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
