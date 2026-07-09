import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '../../auth/me/route'
import { parseSkills, parseDates } from '@/lib/conflicts'

// GET /api/profiles/me — returns the current user's linked profile
export async function GET(req: Request) {
  const user = await getAuthUser(req as any)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!user.profileId) {
    return NextResponse.json({ error: 'No profile linked' }, { status: 404 })
  }
  const profile = await db.profile.findUnique({ where: { id: user.profileId } })
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  return NextResponse.json({
    ...profile,
    skillsList: parseSkills(profile.skills),
    unavailableList: parseDates(profile.unavailable),
  })
}
