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
      available: body.available ?? null,
      unavailable: Array.isArray(body.unavailable) ? body.unavailable.join(',') : (body.unavailable ?? null),
      contractSigned: !!body.contractSigned,
      notes: body.notes ?? null,
    },
  })
  return NextResponse.json(created, { status: 201 })
}

// PUT /api/profiles?id=... — full update
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') data.name = body.name
  if (typeof body.sex === 'string' || body.sex === null) data.sex = body.sex ?? null
  if (typeof body.role === 'string') data.role = body.role
  if (typeof body.roleTier === 'string') data.roleTier = body.roleTier
  if ('skills' in body) {
    data.skills = Array.isArray(body.skills) ? body.skills.join(',') : (body.skills ?? '')
  }
  if ('available' in body) data.available = body.available ?? null
  if ('unavailable' in body) {
    data.unavailable = Array.isArray(body.unavailable)
      ? body.unavailable.join(',')
      : (body.unavailable ?? null)
  }
  if (typeof body.contractSigned === 'boolean') data.contractSigned = body.contractSigned
  if ('notes' in body) data.notes = body.notes ?? null

  const updated = await db.profile.update({ where: { id }, data })
  return NextResponse.json(updated)
}

// DELETE /api/profiles?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.profile.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
