import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/auth/claim
// Body: { token: string, name?: string, email?: string }
// Sets an httpOnly cookie with the user's id upon successful claim.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, name, email } = body as { token: string; name?: string; email?: string }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const user = await db.user.findUnique({ where: { inviteToken: token } })
  if (!user) return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Invite link has expired' }, { status: 410 })
  }

  const updates: Record<string, unknown> = { claimedAt: new Date() }
  if (email) updates.email = email
  if (name) updates.name = name

  const updated = await db.user.update({
    where: { id: user.id },
    data: updates,
    include: { profile: true },
  })

  const res = NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      profileId: updated.profileId,
    },
  })
  res.cookies.set('ra-user-id', updated.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
