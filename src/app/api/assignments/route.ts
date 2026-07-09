import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseSkills,
  parseDates,
  runAllChecks,
  type ProfileLite,
  type AssignmentLite,
  type EventLite,
  type ConflictResult,
} from '@/lib/conflicts'

// GET /api/assignments?eventId=...&profileId=...&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  const profileId = searchParams.get('profileId')
  const date = searchParams.get('date')

  const where: Record<string, unknown> = {}
  if (eventId) where.eventId = eventId
  if (profileId) where.profileId = profileId
  if (date) where.assignedDate = new Date(`${date}T00:00:00.000Z`)

  const assignments = await db.assignment.findMany({
    where,
    include: { profile: true, event: true },
    orderBy: { assignedDate: 'asc' },
  })
  return NextResponse.json(assignments)
}

// POST /api/assignments
// Body: { eventId, profileId, date, isAlternative?, shirtColor?, overrideFlag? }
// Hard errors (overlap, unavailable) return 409 and cannot be overridden.
// Fatigue warnings return 409 with conflict.details; client can re-POST with overrideFlag=true.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, profileId, date, overrideFlag, isAlternative, shirtColor } = body as {
    eventId: string
    profileId: string
    date: string
    overrideFlag?: boolean
    isAlternative?: boolean
    shirtColor?: string | null
  }
  if (!eventId || !profileId || !date) {
    return NextResponse.json({ error: 'Missing eventId, profileId or date' }, { status: 400 })
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

  const profileLite: ProfileLite = {
    id: profile.id,
    name: profile.name,
    roleTier: profile.roleTier,
    skills: parseSkills(profile.skills),
    unavailable: parseDates(profile.unavailable),
  }
  const sameDayAssignments = await db.assignment.findMany({
    where: { assignedDate: new Date(`${date}T00:00:00.000Z`) },
    include: { event: true },
  })
  const assignmentLite: AssignmentLite[] = sameDayAssignments.map(a => ({
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

  const conflict: ConflictResult = runAllChecks({
    profile: profileLite,
    date,
    event: eventLite,
    existing: assignmentLite,
  })

  if (conflict.level === 'error') {
    return NextResponse.json(
      { error: 'Conflict', conflict },
      { status: 409 },
    )
  }
  if (conflict.level === 'warning' && !overrideFlag) {
    return NextResponse.json(
      { error: 'Confirmation needed', conflict },
      { status: 409 },
    )
  }

  try {
    const created = await db.assignment.create({
      data: {
        eventId,
        profileId,
        assignedDate: new Date(`${date}T00:00:00.000Z`),
        status: 'Assigned',
        isAlternative: !!isAlternative,
        shirtColor: shirtColor ?? null,
        overrideFlag: !!overrideFlag,
      },
      include: { profile: true, event: true },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: 'Already assigned to this event on this date', detail: String(e) },
      { status: 409 },
    )
  }
}

// PATCH /api/assignments?id=...
// Body: { isAlternative?, shirtColor?, status? }
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (typeof body.isAlternative === 'boolean') data.isAlternative = body.isAlternative
  if ('shirtColor' in body) data.shirtColor = body.shirtColor ?? null
  if (typeof body.status === 'string') data.status = body.status
  const updated = await db.assignment.update({ where: { id }, data })
  return NextResponse.json(updated)
}

// DELETE /api/assignments?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.assignment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
