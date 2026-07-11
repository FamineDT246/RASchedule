import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// POST /api/notifications/read?id=<notificationId> — mark a single notification as read
// POST /api/notifications/read (no id) — mark ALL of the user's notifications as read
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  try {
    if (id) {
      await db.execute({
        sql: "UPDATE Notification SET readAt = datetime('now') WHERE id = ? AND userId = ?",
        args: [id, user.id],
      })
    } else {
      await db.execute({
        sql: "UPDATE Notification SET readAt = datetime('now') WHERE userId = ? AND readAt IS NULL",
        args: [user.id],
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: true }) // table might not exist yet
  }
}
