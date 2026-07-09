import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper: read the user id from the cookie, return the user (with profile) or null.
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get('ra-user-id')?.value
  if (!token) return null
  const user = await db.user.findFirst({
    where: { id: token },
    include: { profile: true },
  })
  if (!user || !user.claimedAt) return null
  return user
}

// GET /api/auth/me — returns the currently logged-in user (or null)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileId: user.profileId,
      profile: user.profile ? {
        id: user.profile.id,
        name: user.profile.name,
        roleTier: user.profile.roleTier,
        role: user.profile.role,
        skills: user.profile.skills,
        unavailable: user.profile.unavailable,
      } : null,
    },
  })
}
