import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// POST /api/auth/update-email-prefs — toggle emailNotifications for the current user
// Body: { emailNotifications: boolean }
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { emailNotifications } = body as { emailNotifications: boolean }

  try {
    await db.execute({
      sql: 'UPDATE User SET emailNotifications = ? WHERE id = ?',
      args: [emailNotifications ? 1 : 0, user.id],
    })
  } catch (e: any) {
    // Column might not exist yet — try ALTER TABLE first
    try {
      await db.execute({ sql: 'ALTER TABLE User ADD COLUMN emailNotifications INTEGER NOT NULL DEFAULT 1' })
      await db.execute({
        sql: 'UPDATE User SET emailNotifications = ? WHERE id = ?',
        args: [emailNotifications ? 1 : 0, user.id],
      })
    } catch (e2: any) {
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, emailNotifications })
}
