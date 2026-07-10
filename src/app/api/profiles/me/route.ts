import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

function parseList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

// GET /api/profiles/me — returns the current user's linked profile
export async function GET(req: Request) {
  const user = await getAuthUser(req as any)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!user.profileId) return NextResponse.json({ error: 'No profile linked' }, { status: 404 })

  const result = await db.execute({ sql: 'SELECT * FROM Profile WHERE id = ?', args: [user.profileId] })
  if (result.rows.length === 0) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const p = result.rows[0] as any
  return NextResponse.json({
    ...p,
    skillsList: parseList(p.skills),
    unavailableList: parseList(p.unavailable),
  })
}
