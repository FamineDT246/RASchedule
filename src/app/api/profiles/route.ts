import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from '@/lib/db'
import { getAuthUser } from '../auth/me/route'

function parseList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

// GET /api/profiles
export async function GET() {
  const result = await db.execute(
    `SELECT * FROM Profile ORDER BY roleTier ASC, name ASC`
  )
  return NextResponse.json(result.rows.map((p: any) => ({
    ...p,
    skillsList: parseList(p.skills),
    unavailableList: parseList(p.unavailable),
  })))
}

// POST /api/profiles — create
export async function POST(req: NextRequest) {
  const authCheck = await requireAdmin(req); if (authCheck) return authCheck;
  const body = await req.json()
  const id = crypto.randomUUID()
  const skills = Array.isArray(body.skills) ? body.skills.join(',') : (body.skills ?? '')
  const unavailable = Array.isArray(body.unavailable) ? body.unavailable.join(',') : (body.unavailable ?? null)

  await db.execute({
    sql: `INSERT INTO Profile (id, name, sex, role, roleTier, skills, available, unavailable, contractSigned, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [id, body.name, body.sex ?? null, body.role, body.roleTier ?? 'Junior',
           skills, body.available ?? null, unavailable, !!body.contractSigned, body.notes ?? null],
  })

  const result = await db.execute({ sql: 'SELECT * FROM Profile WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0], { status: 201 })
}

// PUT /api/profiles?id=...
export async function PUT(req: NextRequest) {
  const authCheck2 = await requireAdmin(req); if (authCheck2) return authCheck2;
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()

  const updates: string[] = []
  const args: unknown[] = []
  if (typeof body.name === 'string') { updates.push('name = ?'); args.push(body.name) }
  if ('sex' in body) { updates.push('sex = ?'); args.push(body.sex ?? null) }
  if (typeof body.role === 'string') { updates.push('role = ?'); args.push(body.role) }
  if (typeof body.roleTier === 'string') { updates.push('roleTier = ?'); args.push(body.roleTier) }
  if ('skills' in body) {
    updates.push('skills = ?')
    args.push(Array.isArray(body.skills) ? body.skills.join(',') : (body.skills ?? ''))
  }
  if ('available' in body) { updates.push('available = ?'); args.push(body.available ?? null) }
  if ('unavailable' in body) {
    updates.push('unavailable = ?')
    args.push(Array.isArray(body.unavailable) ? body.unavailable.join(',') : (body.unavailable ?? null))
  }
  if (typeof body.contractSigned === 'boolean') { updates.push('contractSigned = ?'); args.push(body.contractSigned) }
  if ('notes' in body) { updates.push('notes = ?'); args.push(body.notes ?? null) }

  if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  updates.push("updatedAt = datetime('now')")
  args.push(id)

  await db.execute({ sql: `UPDATE Profile SET ${updates.join(', ')} WHERE id = ?`, args })
  const result = await db.execute({ sql: 'SELECT * FROM Profile WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0])
}

// DELETE /api/profiles?id=...
export async function DELETE(req: NextRequest) {
  const authCheck3 = await requireAdmin(req); if (authCheck3) return authCheck3;
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM Profile WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
