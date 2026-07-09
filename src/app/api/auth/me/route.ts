import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

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
      mustChangePassword: user.email === 'jelani@robotadventure.local' && user.passwordHash === await bcrypt.hash('changeme', 10) ? false : false, // placeholder
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

// POST /api/auth/login — email + password login
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password } = body as { email: string; password: string }
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email }, include: { profile: true } })
  if (!user || !user.passwordHash || !user.claimedAt) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const res = NextResponse.json({
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
  res.cookies.set('ra-user-id', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
