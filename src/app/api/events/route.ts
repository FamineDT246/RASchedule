import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const events = await db.event.findMany({
    include: { skills: true, assignments: true },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json(events)
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
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      startTime: body.startTime,
      endTime: body.endTime,
      status: body.status ?? 'Confirmed',
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
