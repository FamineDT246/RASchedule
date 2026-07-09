import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '../auth/me/route'

// GET /api/opt-ins?eventId=...
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')

  let sql = `SELECT o.*, u.name as userName, u.profileId as userProfileId, p.name as userProfileName,
             e.name as eventName
             FROM OptIn o
             JOIN User u ON o.userId = u.id
             LEFT JOIN Profile p ON u.profileId = p.id
             JOIN Event e ON o.eventId = e.id`
  const args: unknown[] = []

  if (eventId) {
    sql += ' WHERE o.eventId = ?'
    args.push(eventId)
  } else if (user.role === 'instructor') {
    sql += ' WHERE o.userId = ?'
    args.push(user.id)
  }

  sql += ' ORDER BY o.createdAt DESC'

  const result = await db.execute({ sql, args })
  return NextResponse.json(result.rows.map((o: any) => ({
    id: o.id,
    userId: o.userId,
    userName: o.userName,
    userProfileId: o.userProfileId,
    userProfileName: o.userProfileName,
    eventId: o.eventId,
    eventName: o.eventName,
    status: o.status,
    note: o.note,
    createdAt: new Date(o.createdAt).toISOString(),
  })))
}

// POST /api/opt-ins — upsert
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role !== 'instructor') {
    return NextResponse.json({ error: 'Admins cannot opt in' }, { status: 403 })
  }

  const body = await req.json()
  const { eventId, status, note } = body as { eventId: string; status: string; note?: string }
  if (!eventId || !['interested', 'available', 'unavailable'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Check if opt-in exists
  const existing = await db.execute({
    sql: 'SELECT id FROM OptIn WHERE userId = ? AND eventId = ?',
    args: [user.id, eventId],
  })

  if (existing.rows.length > 0) {
    const id = (existing.rows[0] as any).id
    await db.execute({
      sql: "UPDATE OptIn SET status = ?, note = ?, updatedAt = datetime('now') WHERE id = ?",
      args: [status, note ?? null, id],
    })
    return NextResponse.json({ id, userId: user.id, eventId, status, note })
  } else {
    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO OptIn (id, userId, eventId, status, note, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [id, user.id, eventId, status, note ?? null],
    })
    return NextResponse.json({ id, userId: user.id, eventId, status, note }, { status: 201 })
  }
}
