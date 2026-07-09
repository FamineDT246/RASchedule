import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSkills, parseDates } from '@/lib/conflicts'

export async function GET() {
  const profiles = await db.profile.findMany({ orderBy: [{ roleTier: 'asc' }, { name: 'asc' }] })
  return NextResponse.json(
    profiles.map(p => ({
      ...p,
      skillsList: parseSkills(p.skills),
      unavailableList: parseDates(p.unavailable),
    })),
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const created = await db.profile.create({
    data: {
      name: body.name,
      sex: body.sex ?? null,
      role: body.role,
      roleTier: body.roleTier ?? 'Junior',
      skills: Array.isArray(body.skills) ? body.skills.join(',') : (body.skills ?? ''),
      shirtSize: body.shirtSize ?? null,
      shirtType: body.shirtType ?? null,
      shirtColors: body.shirtColors ?? null,
      available: body.available ?? null,
      unavailable: Array.isArray(body.unavailable) ? body.unavailable.join(',') : (body.unavailable ?? null),
      contractSigned: !!body.contractSigned,
      notes: body.notes ?? null,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
