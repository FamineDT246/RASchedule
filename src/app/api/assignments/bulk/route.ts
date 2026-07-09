import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseSkills, parseDates, runAllChecks,
  type ProfileLite, type AssignmentLite, type EventLite, type ConflictResult,
} from '@/lib/conflicts'

// POST /api/assignments/bulk
// Body: { eventId, profileId }
// Assigns the profile to ALL days of the event (start..end, or specificDates if set).
// Returns per-day results: [{ date, status, conflict? }]
//   status: 'created' | 'conflict' | 'exists'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, profileId } = body as { eventId: string; profileId: string }
  if (!eventId || !profileId) {
    return NextResponse.json({ error: 'Missing eventId or profileId' }, { status: 400 })
  }

  const [profile, event] = await Promise.all([
    db.profile.findUnique({ where: { id: profileId } }),
    db.event.findUnique({
      where: { id: eventId },
      include: { skills: true, assignments: true },
    }),
  ])
  if (!profile || !event) {
    return NextResponse.json({ error: 'Profile or event not found' }, { status: 404 })
  }

  // Build the list of dates to assign
  let dates: string[]
  if (event.specificDates) {
    dates = parseDates(event.specificDates)
  } else {
    dates = []
    const d = new Date(event.startDate)
    const end = new Date(event.endDate)
    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 1)
    }
  }

  // Skip Draft/Cancelled events
  if (event.status === 'Draft' || event.status === 'Cancelled') {
    return NextResponse.json(
      { error: `Cannot assign to a ${event.status} event` },
      { status: 400 },
    )
  }

  const profileLite: ProfileLite = {
    id: profile.id,
    name: profile.name,
    roleTier: profile.roleTier,
    skills: parseSkills(profile.skills),
    unavailable: parseDates(profile.unavailable),
  }

  // Load all assignments for the relevant dates in one query
  const allAssignments = await db.assignment.findMany({
    where: {
      assignedDate: {
        gte: new Date(`${dates[0]}T00:00:00.000Z`),
        lte: new Date(`${dates[dates.length - 1]}T23:59:59.000Z`),
      },
    },
    include: { event: true },
  })

  const results: { date: string; status: 'created' | 'conflict' | 'exists'; conflict?: ConflictResult }[] = []

  for (const date of dates) {
    // Already assigned to this event on this date?
    const existing = allAssignments.find(
      a => a.eventId === eventId && a.profileId === profileId && a.assignedDate.toISOString().slice(0, 10) === date,
    )
    if (existing) {
      results.push({ date, status: 'exists' })
      continue
    }

    // Run conflict checks
    const sameDay = allAssignments.filter(a => a.assignedDate.toISOString().slice(0, 10) === date)
    const assignmentLite: AssignmentLite[] = sameDay.map(a => ({
      id: a.id,
      profileId: a.profileId,
      assignedDate: date,
      startTime: a.event.startTime,
      endTime: a.event.endTime,
      eventName: a.event.name,
    }))
    const currentAssignees = event.assignments.filter(
      a => a.assignedDate.toISOString().slice(0, 10) === date,
    ).length
    const eventLite: EventLite = {
      id: event.id,
      name: event.name,
      startDate: event.startDate.toISOString().slice(0, 10),
      endDate: event.endDate.toISOString().slice(0, 10),
      startTime: event.startTime,
      endTime: event.endTime,
      requiredInstructors: event.requiredInstructors,
      requiredSkills: event.skills.map(s => s.skillName),
      currentAssignees,
    }
    const conflict = runAllChecks({
      profile: profileLite,
      date,
      event: eventLite,
      existing: assignmentLite,
    })

    if (conflict.level === 'error') {
      results.push({ date, status: 'conflict', conflict })
      continue
    }

    // Create the assignment (soft warnings are auto-skipped in bulk mode)
    try {
      await db.assignment.create({
        data: {
          eventId,
          profileId,
          assignedDate: new Date(`${date}T00:00:00.000Z`),
          status: 'Assigned',
          isAlternative: false,
          shirtColor: null,
        },
      })
      results.push({ date, status: 'created' })
    } catch (e) {
      // Unique constraint = already exists
      results.push({ date, status: 'exists' })
    }
  }

  const created = results.filter(r => r.status === 'created').length
  const conflicts = results.filter(r => r.status === 'conflict')
  const existing = results.filter(r => r.status === 'exists').length

  return NextResponse.json({
    created,
    existing,
    conflicts: conflicts.length,
    details: results,
  }, { status: conflicts.length > 0 && created === 0 ? 409 : 200 })
}
