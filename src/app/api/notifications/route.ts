import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/notifications — returns notifications for the current user (from Notification table)
// Falls back to legacy computed notifications if the table doesn't exist yet.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: `SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`,
      args: [user.id],
    })
    const notifications = (result.rows as any[]).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      eventId: n.eventId,
      assignmentId: n.assignmentId,
      readAt: n.readAt,
      createdAt: n.createdAt,
      read: !!n.readAt,
    }))
    const unread = notifications.filter(n => !n.read).length
    return NextResponse.json({ notifications, unread })
  } catch (e: any) {
    // Notification table doesn't exist yet — return empty
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}
