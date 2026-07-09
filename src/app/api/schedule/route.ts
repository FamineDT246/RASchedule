import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSkills, parseDates } from '@/lib/conflicts'

// GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD&includeDrafts=1
// Returns profiles, events (with skills), assignments, and opt-in counts in the window.
// By default, Draft events are excluded. Pass includeDrafts=1 to include them.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')
  const includeDrafts = searchParams.get('includeDrafts') === '1'

  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : new Date('2026-06-01T00:00:00.000Z')
  const to = toStr ? new Date(`${toStr}T23:59:59.000Z`) : new Date('2026-09-30T23:59:59.000Z')

  const [profiles, events, assignments, optIns] = await Promise.all([
    db.profile.findMany({ orderBy: [{ roleTier: 'asc' }, { name: 'asc' }] }),
    db.event.findMany({
      where: {
        AND: [
          includeDrafts ? {} : { status: { not: 'Draft' } },
          {
            OR: [
              { startDate: { gte: from, lte: to } },
              { endDate: { gte: from, lte: to } },
              { AND: [{ startDate: { lte: from } }, { endDate: { gte: to } }] },
            ],
          },
        ],
      },
      include: { skills: true },
      orderBy: { startDate: 'asc' },
    }),
    db.assignment.findMany({
      where: { assignedDate: { gte: from, lte: to } },
      include: { profile: true, event: true },
      orderBy: { assignedDate: 'asc' },
    }),
    db.optIn.findMany({
      include: { user: { include: { profile: true } } },
    }),
  ])

  // Group opt-ins by event id, with interested/available/unavailable counts + names
  const optInsByEvent: Record<string, { interested: any[]; available: any[]; unavailable: any[] }> = {}
  for (const o of optIns) {
    if (!optInsByEvent[o.eventId]) optInsByEvent[o.eventId] = { interested: [], available: [], unavailable: [] }
    const entry = {
      id: o.id,
      status: o.status,
      note: o.note,
      userId: o.userId,
      userName: o.user.name,
      userProfileId: o.user.profileId,
      userProfileName: o.user.profile?.name ?? null,
    }
    ;(optInsByEvent[o.eventId] as any)[o.status]?.push(entry)
  }

  return NextResponse.json({
    profiles: profiles.map(p => ({
      ...p,
      skillsList: parseSkills(p.skills),
      unavailableList: parseDates(p.unavailable),
    })),
    events: events.map(e => ({
      ...e,
      startDate: e.startDate.toISOString().slice(0, 10),
      endDate: e.endDate.toISOString().slice(0, 10),
      specificDatesList: e.specificDates ? parseDates(e.specificDates) : [],
      requiredSkills: e.skills.map(s => s.skillName),
      optIns: optInsByEvent[e.id] ?? { interested: [], available: [], unavailable: [] },
    })),
    assignments: assignments.map(a => ({
      id: a.id,
      eventId: a.eventId,
      profileId: a.profileId,
      date: a.assignedDate.toISOString().slice(0, 10),
      status: a.status,
      overrideFlag: a.overrideFlag,
      isAlternative: a.isAlternative,
      shirtColor: a.shirtColor,
      profileName: a.profile.name,
      profileRoleTier: a.profile.roleTier,
      eventName: a.event.name,
      eventHostColor: a.event.hostColor,
    })),
  })
}
