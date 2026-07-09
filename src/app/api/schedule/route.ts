import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSkills, parseDates } from '@/lib/conflicts'

// GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns profiles, events (with skills), and assignments in the window —
// everything the calendar grid needs in one round-trip.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')

  const from = fromStr ? new Date(`${fromStr}T00:00:00.000Z`) : new Date('2026-06-01T00:00:00.000Z')
  const to = toStr ? new Date(`${toStr}T23:59:59.000Z`) : new Date('2026-09-30T23:59:59.000Z')

  const [profiles, events, assignments] = await Promise.all([
    db.profile.findMany({ orderBy: [{ roleTier: 'asc' }, { name: 'asc' }] }),
    db.event.findMany({
      where: {
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
          { AND: [{ startDate: { lte: from } }, { endDate: { gte: to } }] },
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
  ])

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
      requiredSkills: e.skills.map(s => s.skillName),
    })),
    assignments: assignments.map(a => ({
      id: a.id,
      eventId: a.eventId,
      profileId: a.profileId,
      date: a.assignedDate.toISOString().slice(0, 10),
      status: a.status,
      overrideFlag: a.overrideFlag,
      profileName: a.profile.name,
      profileRoleTier: a.profile.roleTier,
      eventName: a.event.name,
      eventHostColor: a.event.hostColor,
    })),
  })
}
