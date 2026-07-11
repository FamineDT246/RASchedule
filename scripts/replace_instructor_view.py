#!/usr/bin/env python3
"""Replace the main InstructorView return JSX with the new 3-tab version."""

import re

PATH = '/home/z/my-project/src/components/scheduler/InstructorView.tsx'

with open(PATH, 'r') as f:
    content = f.read()

# Find the return block — from "  return (" to the next "\n}\n" that ends the component
# The component ends right before "// ---------- Carousel component ----------"
start_marker = "  return (\n    <div className=\"flex-1 flex flex-col min-h-0 overflow-hidden\">"
end_marker = "    </div>\n  )\n}\n\n// ---------- Carousel component ----------"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    raise SystemExit("Could not find start marker")
if end_idx == -1:
    raise SystemExit("Could not find end marker")

# Build the new return block
new_block = '''  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tab navigation */}
      <nav
        className="border-b border-border/60 bg-card/30 flex items-center gap-1 px-2 sm:px-3 overflow-x-auto"
        role="tablist"
        aria-label="Instructor views"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <button
          role="tab"
          aria-selected={viewMode === 'assignments'}
          onClick={() => setViewMode('assignments')}
          className={cn(
            'px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center shrink-0',
            viewMode === 'assignments'
              ? 'border-emerald-400 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Calendar className="h-4 w-4 mr-1.5 inline" />
          My Assignments
          {myAssignments.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({myAssignments.length})</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'events'}
          onClick={() => setViewMode('events')}
          className={cn(
            'px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center shrink-0',
            viewMode === 'events'
              ? 'border-emerald-400 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Star className="h-4 w-4 mr-1.5 inline" />
          Opt In
          {optableEvents.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({optableEvents.length})</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'calendar'}
          onClick={() => setViewMode('calendar')}
          className={cn(
            'px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center shrink-0',
            viewMode === 'calendar'
              ? 'border-emerald-400 text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <CalendarDays className="h-4 w-4 mr-1.5 inline" />
          Calendar
        </button>
      </nav>

      {viewMode === 'calendar' && data ? (
        <CalendarView
          events={data.events}
          assignments={data.assignments}
          myProfileId={user.profile?.id}
          readOnly
          onSelect={(eventId, date) => {
            const ev = data.events.find(e => e.id === eventId)
            if (ev) setSelectedEvent(ev)
          }}
        />
      ) : viewMode === 'assignments' ? (
        <div className="flex-1 overflow-y-auto" role="region" aria-label="My assignments">
          <div className="p-3 sm:p-4 space-y-4">
            <Accordion
              label={`My Assignments (${myAssignments.length})`}
              labelClassName="bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              defaultOpen
            >
              {myAssignments.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  {user.profile
                    ? 'No assignments yet. Go to the Opt In tab to express interest in events.'
                    : 'No staff profile linked. Ask the boss to link your account.'}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {myAssignments.map(a => {
                    const ev = data?.events.find((e: EventView) => e.id === a.eventId)
                    if (!ev) return null
                    const colors = hostColor(ev.hostColor)
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={cn(
                          'rounded-lg border p-3 flex items-center gap-3 cursor-pointer hover:border-foreground/30 transition-all',
                          a.isAlternative
                            ? 'border-amber-500/30 border-dashed bg-amber-500/5'
                            : 'border-border/60 bg-card/80',
                        )}
                      >
                        <div className={cn('h-8 w-1 rounded-full shrink-0', colors.bar)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{ev.name}</p>
                            {a.isAlternative && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex items-center gap-0.5 shrink-0">
                                <Shield className="h-3 w-3" /> Alt
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {formatPrettyDate(a.date)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {formatTime(ev.startTime)}
                            </span>
                            {a.shirtColor && (
                              <span className="flex items-center gap-0.5">
                                <Shirt className="h-3 w-3" />
                                {a.shirtColor}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Accordion>

            {/* Availability section */}
            {user.profile && (
              <AvailabilitySection
                profileId={user.profile.id}
                initialUnavailable={myProfile?.unavailableList ?? user.profile.unavailable?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? []}
              />
            )}
          </div>
        </div>
      ) : viewMode === 'events' ? (
        <div className="flex-1 overflow-y-auto" role="region" aria-label="Events to opt in to">
          <div className="p-3 sm:p-4">
            {optableEvents.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">
                No events available for opt-in right now.
              </div>
            ) : (
              <CarouselGroup
                items={optableEvents.map(ev => {
                  const colors = hostColor(ev.hostColor)
                  const optIn = optIns?.[ev.id]
                  const isAssigned = myAssignments.some(a => a.eventId === ev.id)
                  return (
                    <div
                      onClick={() => setSelectedEvent(ev)}
                      className="rounded-lg border border-border/60 bg-card/80 p-3 cursor-pointer hover:border-foreground/30 transition-all flex flex-col gap-2 h-full"
                    >
                      <div className={cn('h-1 rounded-full', colors.bar)} />
                      <div className="flex items-start gap-2">
                        <div className={cn('h-8 w-1 rounded-full shrink-0', colors.bar)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{ev.name}</p>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-3 w-3" />
                              {formatShortDate(ev.startDate)}{ev.endDate !== ev.startDate && ` – ${formatShortDate(ev.endDate)}`}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {formatTime(ev.startTime)}
                            </span>
                          </div>
                          {ev.location && (
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5 truncate">
                              <MapPin className="h-3 w-3" />
                              {ev.location}
                            </div>
                          )}
                        </div>
                      </div>
                      {isAssigned ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1">
                          <Check className="h-3.5 w-3.5" />
                          You&apos;re assigned to this event
                        </div>
                      ) : (
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <OptInButton
                            active={optIn?.status === 'interested'}
                            color="active:bg-teal-500/20 bg-teal-500/10 text-teal-300 border-teal-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'interested' }) }}
                            icon={<Star className="h-3.5 w-3.5" />}
                            label="Interested"
                          />
                          <OptInButton
                            active={optIn?.status === 'available'}
                            color="active:bg-emerald-500/20 bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'available' }) }}
                            icon={<Check className="h-3.5 w-3.5" />}
                            label="Available"
                          />
                          <OptInButton
                            active={optIn?.status === 'unavailable'}
                            color="active:bg-rose-500/20 bg-rose-500/10 text-rose-300 border-rose-500/40"
                            onClick={(e) => { e.stopPropagation(); optInMutation.mutate({ eventId: ev.id, status: 'unavailable' }) }}
                            icon={<X className="h-3.5 w-3.5" />}
                            label="Can&apos;t"
                          />
                        </div>
                      )}
                      <p className="text-[9px] text-muted-foreground/50 text-center">Tap for details</p>
                    </div>
                  )
                })}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Event details drawer */}
      {selectedEvent && (
        <InstructorEventDrawer
          event={selectedEvent}
          optIn={optIns?.[selectedEvent.id]}
          isAssigned={myAssignments.some(a => a.eventId === selectedEvent.id)}
          onOptIn={(status) => optInMutation.mutate({ eventId: selectedEvent.id, status })}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

// ---------- Carousel (5 items per group, horizontal scroll on each group) ----------'''

# Replace the old block (including its closing brace and comment) with the new block
# The old block ends with: "    </div>\n  )\n}\n\n// ---------- Carousel component ----------"
# We need to keep the new_block + "\n\n" and then the rest of the file starting from the Carousel function definition

new_content = content[:start_idx] + new_block + content[end_idx + len(end_marker):]

with open(PATH, 'w') as f:
    f.write(new_content)

print(f"Replaced return block ({end_idx - start_idx} chars) with new block ({len(new_block)} chars)")
print(f"New file length: {len(new_content)} chars")
