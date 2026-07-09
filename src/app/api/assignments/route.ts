import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '../auth/me/route'

// GET /api/assignments?eventId=...&profileId=...&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  const profileId = searchParams.get('profileId')
  const date = searchParams.get('date')

  let sql = `SELECT a.*, p.name as profileName, p.roleTier as profileRoleTier,
             e.name as eventName, e.hostColor as eventHostColor, e.startTime, e.endTime
             FROM Assignment a
             JOIN Profile p ON a.profileId = p.id
             JOIN Event e ON a.eventId = e.id`
  const conditions: string[] = []
  const args: unknown[] = []

  if (eventId) { conditions.push('a.eventId = ?'); args.push(eventId) }
  if (profileId) { conditions.push('a.profileId = ?'); args.push(profileId) }
  if (date) { conditions.push('a.assignedDate = ?'); args.push(new Date(date + 'T00:00:00.000Z').toISOString()) }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY a.assignedDate ASC'

  const result = await db.execute({ sql, args })
  return NextResponse.json(result.rows.map((a: any) => ({
    ...a,
    assignedDate: a.assignedDate,
  })))
}

// POST /api/assignments — create single assignment
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, profileId, date, overrideFlag, isAlternative, shirtColor } = body as {
    eventId: string; profileId: string; date: string
    overrideFlag?: boolean; isAlternative?: boolean; shirtColor?: string | null
  }

  if (!eventId || !profileId || !date) {
    return NextResponse.json({ error: 'Missing eventId, profileId or date' }, { status: 400 })
  }

  // Block assignments on past dates
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Barbados',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  if (date < today) {
    return NextResponse.json(
      { error: 'Cannot assign to a past date. That day has already passed.' },
      { status: 400 },
    )
  }

  const id = crypto.randomUUID()
  await db.execute({
    sql: `INSERT INTO Assignment (id, eventId, profileId, assignedDate, status, isAlternative, shirtColor, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'Assigned', ?, ?, datetime('now'), datetime('now'))`,
    args: [id, eventId, profileId, new Date(date + 'T00:00:00.000Z').toISOString(),
           !!isAlternative, shirtColor ?? null],
  })

  const result = await db.execute({ sql: 'SELECT * FROM Assignment WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0], { status: 201 })
}

// PATCH /api/assignments?id=...
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()

  const updates: string[] = []
  const args: unknown[] = []
  if (typeof body.isAlternative === 'boolean') { updates.push('isAlternative = ?'); args.push(body.isAlternative) }
  if ('shirtColor' in body) { updates.push('shirtColor = ?'); args.push(body.shirtColor ?? null) }
  if (typeof body.status === 'string') { updates.push('status = ?'); args.push(body.status) }

  if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  updates.push("updatedAt = datetime('now')")
  args.push(id)

  await db.execute({ sql: `UPDATE Assignment SET ${updates.join(', ')} WHERE id = ?`, args })
  const result = await db.execute({ sql: 'SELECT * FROM Assignment WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0])
}

// DELETE /api/assignments?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM Assignment WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
