import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const events = await db.event.findMany({
    include: { skills: true, assignments: true, optIns: { include: { user: true } } },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(events.map(e => ({
    ...e,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
    specificDatesList: e.specificDates ? e.specificDates.split(',').map(s => s.trim()).filter(Boolean) : [],
    requiredSkills: e.skills.map(s => s.skillName),
    _assignmentCount: e.assignments.length,
    _optInCount: e.optIns.length,
    _optIns: e.optIns.map(o => ({ id: o.id, status: o.status, note: o.note, userId: o.userId, userName: o.user.name })),
  })))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await db.event.create({
    data: {
      code: body.code ?? null,
      name: body.name,
      host: body.host,
      hostColor: body.hostColor ?? 'slate',
      location: body.location ?? null,
      description: body.description ?? null,
      lengthDays: body.lengthDays ?? null,
      startDate: new Date(`${body.startDate}T00:00:00.000Z`),
      endDate: new Date(`${body.endDate}T23:59:59.000Z`),
      startTime: body.startTime ?? '09:00',
      endTime: body.endTime ?? '15:00',
      status: body.status ?? 'Confirmed',
      specificDates: Array.isArray(body.specificDates) && body.specificDates.length
        ? body.specificDates.join(',')
        : null,
      ageRange: body.ageRange ?? null,
      participantCount: body.participantCount ?? null,
      requiredInstructors: body.requiredInstructors ?? 2,
      notes: body.notes ?? null,
      skills: body.skills
        ? { create: (body.skills as string[]).map(skillName => ({ skillName })) }
        : undefined,
    },
    include: { skills: true },
  })
  return NextResponse.json(created, { status: 201 })
}

// PUT /api/events?id=... — full update
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()

  // Replace skills list if provided
  if (Array.isArray(body.skills)) {
    await db.eventSkill.deleteMany({ where: { eventId: id } })
    if (body.skills.length > 0) {
      await db.eventSkill.createMany({
        data: body.skills.map((skillName: string) => ({ eventId: id, skillName })),
      })
    }
  }

  const data: Record<string, unknown> = {}
  if (typeof body.code === 'string' || body.code === null) data.code = body.code
  if (typeof body.name === 'string') data.name = body.name
  if (typeof body.host === 'string') data.host = body.host
  if (typeof body.hostColor === 'string') data.hostColor = body.hostColor
  if ('location' in body) data.location = body.location ?? null
  if ('description' in body) data.description = body.description ?? null
  if ('lengthDays' in body) data.lengthDays = body.lengthDays ?? null
  if (typeof body.startDate === 'string') data.startDate = new Date(`${body.startDate}T00:00:00.000Z`)
  if (typeof body.endDate === 'string') data.endDate = new Date(`${body.endDate}T23:59:59.000Z`)
  if (typeof body.startTime === 'string') data.startTime = body.startTime
  if (typeof body.endTime === 'string') data.endTime = body.endTime
  if (typeof body.status === 'string') data.status = body.status
  if ('specificDates' in body) {
    data.specificDates = Array.isArray(body.specificDates) && body.specificDates.length
      ? body.specificDates.join(',')
      : null
  }
  if ('ageRange' in body) data.ageRange = body.ageRange ?? null
  if ('participantCount' in body) data.participantCount = body.participantCount ?? null
  if (typeof body.requiredInstructors === 'number') data.requiredInstructors = body.requiredInstructors
  if ('notes' in body) data.notes = body.notes ?? null

  const updated = await db.event.update({ where: { id }, data, include: { skills: true } })
  return NextResponse.json(updated)
}

// DELETE /api/events?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.event.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
