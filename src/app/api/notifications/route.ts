import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/notifications — returns notifications for the current user
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const notifications: any[] = []

  if (user.role === 'admin') {
    // Recent opt-ins (last 7 days)
    const optIns = await db.execute({
      sql: `SELECT o.*, u.name as userName, e.name as eventName, e.id as eventId
            FROM OptIn o
            JOIN User u ON o.userId = u.id
            JOIN Event e ON o.eventId = e.id
            WHERE o.createdAt >= datetime('now', '-7 days')
            ORDER BY o.createdAt DESC LIMIT 20`,
    })
    for (const o of optIns.rows as any[]) {
      notifications.push({
        id: o.id,
        type: 'opt-in',
        icon: o.status === 'available' ? '✓' : o.status === 'interested' ? '★' : '✗',
        color: o.status === 'available' ? 'emerald' : o.status === 'interested' ? 'teal' : 'rose',
        title: `${o.userName} opted in: ${o.status}`,
        description: o.eventName,
        eventId: o.eventId,
        createdAt: o.createdAt,
      })
    }
  } else if (user.profileId) {
    // Recent assignments for this instructor (last 7 days)
    const assignments = await db.execute({
      sql: `SELECT a.*, e.name as eventName, e.id as eventId, e.hostColor
            FROM Assignment a
            JOIN Event e ON a.eventId = e.id
            WHERE a.profileId = ? AND a.createdAt >= datetime('now', '-7 days')
            ORDER BY a.createdAt DESC LIMIT 20`,
      args: [user.profileId],
    })
    for (const a of assignments.rows as any[]) {
      notifications.push({
        id: a.id,
        type: 'assignment',
        icon: '📅',
        color: 'emerald',
        title: `Assigned to ${a.eventName}`,
        description: a.assignedDate,
        eventId: a.eventId,
        createdAt: a.createdAt,
      })
    }
  }

  return NextResponse.json({ notifications })
}
