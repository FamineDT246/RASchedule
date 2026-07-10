'use client'

import { useDraggable } from '@dnd-kit/core'
import { roleColor } from '@/lib/scheduler-types'
import type { ProfileView } from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'

type Props = {
  profile: ProfileView
  compact?: boolean
}

export function DraggableInstructor({ profile, compact }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `profile-${profile.id}`,
    data: { type: 'profile', profileId: profile.id, profileName: profile.name },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'group relative cursor-grab active:cursor-grabbing rounded-lg border border-border/60 bg-card hover:border-foreground/30 transition-all',
        'hover:shadow-md hover:-translate-y-0.5',
        isDragging && 'opacity-40',
        compact ? 'p-2' : 'p-3',
      )}
      title={`Drag ${profile.name} onto an event`}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'flex items-center justify-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-white font-semibold shrink-0',
            compact ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm',
          )}
        >
          {profile.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium leading-tight truncate">{profile.name}</p>
            {!profile.contractSigned && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Contract not signed" />
            )}
          </div>
          <span
            className={cn(
              'inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border',
              roleColor(profile.roleTier),
            )}
          >
            {profile.roleTier}
          </span>
          {!compact && profile.skillsList.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {profile.skillsList.slice(0, 3).map(s => (
                <span
                  key={s}
                  className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                >
                  {s}
                </span>
              ))}
              {profile.skillsList.length > 3 && (
                <span className="text-[10px] text-muted-foreground px-1">
                  +{profile.skillsList.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
