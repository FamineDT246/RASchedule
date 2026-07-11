import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function parseList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

// GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')
  const includeDrafts = searchParams.get('includeDrafts') === '1'

  const from = fromStr || '2026-06-01'
  const to = toStr || '2026-09-30'

  // Fetch profiles
  const profileResult = await db.execute(
    `SELECT * FROM Profile ORDER BY roleTier ASC, name ASC`
  )
  const profiles = profileResult.rows.map((p: any) => ({
    ...p,
    skillsList: parseList(p.skills),
    unavailableList: parseList(p.unavailable),
  }))

  // Fetch events (exclude Draft and Archived unless includeDrafts=1)
  const eventQuery = includeDrafts
    ? `SELECT * FROM Event WHERE 
       (startDate >= ? AND startDate <= ?) OR 
       (endDate >= ? AND endDate <= ?) OR 
       (startDate <= ? AND endDate >= ?) 
       ORDER BY startDate ASC`
    : `SELECT * FROM Event WHERE status != 'Draft' AND (
       (startDate >= ? AND startDate <= ?) OR 
       (endDate >= ? AND endDate <= ?) OR 
       (startDate <= ? AND endDate >= ?) 
       ) ORDER BY startDate ASC`
  const eventArgs = [from, to, from, to, from, to]
  const eventResult = await db.execute({ sql: eventQuery, args: eventArgs })
  const eventIds = eventResult.rows.map((e: any) => e.id)

  // Fetch skills for events
  let eventSkills: Record<string, string[]> = {}
  if (eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',')
    const skillResult = await db.execute({
      sql: `SELECT * FROM EventSkill WHERE eventId IN (${placeholders})`,
      args: eventIds,
    })
    for (const s of skillResult.rows as any[]) {
      if (!eventSkills[s.eventId]) eventSkills[s.eventId] = []
      eventSkills[s.eventId].push(s.skillName)
    }
  }

  // Fetch opt-ins
  let optInsByEvent: Record<string, any> = {}
  if (eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',')
    const optInResult = await db.execute({
      sql: `SELECT o.*, u.name as userName, u.profileId as userProfileId, p.name as userProfileName
            FROM OptIn o 
            JOIN User u ON o.userId = u.id
            LEFT JOIN Profile p ON u.profileId = p.id
            WHERE o.eventId IN (${placeholders})`,
      args: eventIds,
    })
    for (const o of optInResult.rows as any[]) {
      if (!optInsByEvent[o.eventId]) {
        optInsByEvent[o.eventId] = { interested: [], available: [], unavailable: [] }
      }
      const entry = {
        id: o.id, status: o.status, note: o.note,
        userId: o.userId, userName: o.userName,
        userProfileId: o.userProfileId, userProfileName: o.userProfileName,
      }
      ;(optInsByEvent[o.eventId] as any)[o.status]?.push(entry)
    }
  }

  // Fetch assignments
  const assignmentResult = await db.execute({
    sql: `SELECT a.*, p.name as profileName, p.roleTier as profileRoleTier, 
          e.name as eventName, e.hostColor as eventHostColor
          FROM Assignment a
          JOIN Profile p ON a.profileId = p.id
          JOIN Event e ON a.eventId = e.id
          WHERE a.assignedDate >= ? AND a.assignedDate <= ?
          ORDER BY a.assignedDate ASC`,
    args: [from, to],
  })

  return NextResponse.json({
    profiles,
    events: eventResult.rows.map((e: any) => ({
      ...e,
      startDate: e.startDate?.slice(0, 10),
      endDate: e.endDate?.slice(0, 10),
      specificDatesList: parseList(e.specificDates),
      requiredSkills: eventSkills[e.id] ?? [],
      setupDate: e.setupDate ? String(e.setupDate).slice(0, 10) : null,
      setupTime: e.setupTime ?? null,
      optIns: optInsByEvent[e.id] ?? { interested: [], available: [], unavailable: [] },
    })),
    assignments: assignmentResult.rows.map((a: any) => ({
      id: a.id,
      eventId: a.eventId,
      profileId: a.profileId,
      date: a.assignedDate?.slice(0, 10),
      status: a.status,
      isAlternative: !!a.isAlternative,
      shirtColor: a.shirtColor,
      ackStatus: a.ackStatus ?? null,
      acknowledgedAt: a.acknowledgedAt ?? null,
      profileName: a.profileName,
      profileRoleTier: a.profileRoleTier,
      eventName: a.eventName,
      eventHostColor: a.eventHostColor,
    })),
  })
}
