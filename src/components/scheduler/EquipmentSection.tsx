'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, X, Truck, Package, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EventView, EquipmentItem } from '@/lib/scheduler-types'

type Props = {
  event: EventView
  /** 'admin' = admin can add/remove items; 'instructor' = instructor can claim */
  mode: 'admin' | 'instructor'
  /** For instructor mode, the profileId of the current user */
  myProfileId?: string | null
}

async function fetchEquipment(eventId: string): Promise<EquipmentItem[]> {
  const r = await fetch(`/api/event-equipment?eventId=${eventId}`)
  if (!r.ok) return []
  return r.json()
}

export function EquipmentSection({ event, mode, myProfileId }: Props) {
  const qc = useQueryClient()
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['event-equipment', event.id],
    queryFn: () => fetchEquipment(event.id),
  })

  const [newItemName, setNewItemName] = useState('')
  const [newItemQty, setNewItemQty] = useState(1)

  const addItem = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/event-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, name: newItemName, quantity: newItemQty }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-equipment', event.id] })
      setNewItemName('')
      setNewItemQty(1)
      toast.success('Equipment added')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add'),
  })

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const r = await fetch(`/api/event-equipment?id=${itemId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-equipment', event.id] })
      toast.success('Equipment removed')
    },
  })

  const claimMutation = useMutation({
    mutationFn: async (args: { equipmentItemId: string; quantityClaimed: number; transportOffered: boolean }) => {
      const r = await fetch('/api/equipment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Failed')
      return j
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-equipment', event.id] })
      toast.success('You\'re bringing this — the boss will be notified')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to claim'),
  })

  const releaseClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const r = await fetch(`/api/equipment-claims?id=${claimId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-equipment', event.id] })
      toast.success('Released — no longer bringing this')
    },
  })

  return (
    <div className="rounded-md border border-border/40 bg-card/40 p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Equipment needed
        </h3>
        {mode === 'admin' && (
          <span className="text-[9px] text-muted-foreground/60 ml-auto">
            Add what needs to be there. Instructors claim items they'll bring.
          </span>
        )}
        {mode === 'instructor' && (
          <span className="text-[9px] text-muted-foreground/60 ml-auto">
            Click "I'll bring" to claim an item. The boss will arrange to get it to you.
          </span>
        )}
      </div>

      {/* Equipment list */}
      {isLoading && <p className="text-[10px] text-muted-foreground">Loading…</p>}
      {(equipment ?? []).length === 0 && !isLoading && (
        <p className="text-[10px] text-muted-foreground italic text-center py-2">
          {mode === 'admin' ? 'No equipment added yet.' : 'No equipment needed for this event.'}
        </p>
      )}

      {(equipment ?? []).map(item => {
        const totalClaimed = item.claims.reduce((sum, c) => sum + c.quantityClaimed, 0)
        const fullyClaimed = totalClaimed >= item.quantity
        const myClaim = myProfileId ? item.claims.find(c => c.profileId === myProfileId) : undefined

        return (
          <div
            key={item.id}
            className={cn(
              'rounded-md border p-2.5 space-y-2',
              fullyClaimed
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border/60 bg-muted/20',
            )}
          >
            {/* Item header */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <span className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0',
                    fullyClaimed
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300',
                  )}>
                    {totalClaimed}/{item.quantity}
                  </span>
                </div>
                {item.notes && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.notes}</p>
                )}
              </div>
              {/* Admin: delete */}
              {mode === 'admin' && (
                <button
                  onClick={() => {
                    if (confirm(`Remove "${item.name}"?`)) removeItem.mutate(item.id)
                  }}
                  className="p-1 rounded hover:bg-rose-500/10 hover:text-rose-300 text-muted-foreground shrink-0"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Claims */}
            {item.claims.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.claims.map(c => (
                  <span
                    key={c.id}
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border',
                      c.profileId === myProfileId
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-muted/60 text-foreground/80 border-border/40',
                    )}
                    title={c.notes ?? undefined}
                  >
                    {c.transportOffered && <Truck className="h-2.5 w-2.5" />}
                    {c.profileName} ({c.quantityClaimed})
                    {c.profileId === myProfileId && mode === 'instructor' && (
                      <button
                        onClick={() => releaseClaim.mutate(c.id)}
                        className="hover:text-rose-300 ml-0.5"
                        aria-label="Release my claim"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Instructor: claim button */}
            {mode === 'instructor' && !myClaim && (
              <ClaimForm
                itemId={item.id}
                maxQty={item.quantity - totalClaimed}
                onSubmit={(qty, transport) => claimMutation.mutate({
                  equipmentItemId: item.id,
                  quantityClaimed: qty,
                  transportOffered: transport,
                })}
                disabled={claimMutation.isPending}
              />
            )}

            {/* Instructor: already claimed by me */}
            {mode === 'instructor' && myClaim && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                <Check className="h-3 w-3" />
                You're bringing {myClaim.quantityClaimed}
                {myClaim.transportOffered && ' (transporting)'}
              </div>
            )}
          </div>
        )
      })}

      {/* Admin: add new equipment */}
      {mode === 'admin' && (
        <div className="border-t border-border/40 pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              placeholder="e.g. Drones (Tello EDU)"
              className="flex-1 px-2 py-1.5 text-xs rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              onKeyDown={e => { if (e.key === 'Enter' && newItemName.trim()) addItem.mutate() }}
            />
            <input
              type="number"
              min={1}
              value={newItemQty}
              onChange={e => setNewItemQty(Math.max(1, Number(e.target.value)))}
              className="w-16 px-2 py-1.5 text-xs rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              aria-label="Quantity"
            />
            <button
              onClick={() => newItemName.trim() && addItem.mutate()}
              disabled={!newItemName.trim() || addItem.isPending}
              className="px-2.5 py-1.5 text-xs rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1 min-h-[32px]"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClaimForm({ itemId, maxQty, onSubmit, disabled }: {
  itemId: string
  maxQty: number
  onSubmit: (qty: number, transport: boolean) => void
  disabled: boolean
}) {
  const [qty, setQty] = useState(Math.min(1, maxQty))
  const [transport, setTransport] = useState(true)

  // Clamp qty during render if maxQty shrinks (e.g. another instructor claimed while form was open)
  const effectiveQty = Math.min(qty, maxQty)
  if (maxQty <= 0) return null

  return (
    <div className="flex items-center gap-2 pt-1 border-t border-border/40">
      <button
        onClick={() => onSubmit(effectiveQty, transport)}
        disabled={disabled}
        className="px-2.5 py-1 text-[11px] rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1 min-h-[28px]"
      >
        <Truck className="h-3 w-3" />
        I'll bring
      </button>
      <input
        type="number"
        min={1}
        max={maxQty}
        value={effectiveQty}
        onChange={e => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value))))}
        className="w-14 px-1.5 py-1 text-[11px] rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        aria-label="Quantity you'll bring"
      />
      <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={transport}
          onChange={e => setTransport(e.target.checked)}
          className="h-3 w-3 rounded accent-emerald-500"
        />
        I can transport
      </label>
    </div>
  )
}
