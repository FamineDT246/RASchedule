import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Helper: read the user id from the cookie, return the user (with profile) or null.
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get('ra-user-id')?.value
  if (!token) return null

  const result = await db.execute({
    sql: `SELECT u.*, p.name as profileName, p.roleTier as profileRoleTier, p.role as profileRole, 
          p.skills as profileSkills, p.unavailable as profileUnavailable, p.id as profileId
          FROM User u LEFT JOIN Profile p ON u.profileId = p.id WHERE u.id = ?`,
    args: [token],
  })

  if (result.rows.length === 0) return null
  const row = result.rows[0] as any
  if (!row.claimedAt) return null

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    profileId: row.profileId ?? null,
    passwordHash: row.passwordHash,
    claimedAt: row.claimedAt,
    profile: row.profileId ? {
      id: row.profileId,
      name: row.profileName,
      roleTier: row.profileRoleTier,
      role: row.profileRole,
      skills: row.profileSkills,
      unavailable: row.profileUnavailable,
    } : null,
  }
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
      profile: user.profile,
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

  const result = await db.execute({
    sql: 'SELECT * FROM User WHERE email = ?',
    args: [email],
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const user = result.rows[0] as any
  if (!user.passwordHash || !user.claimedAt) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // Get profile if linked
  let profile = null
  if (user.profileId) {
    const profileResult = await db.execute({
      sql: 'SELECT * FROM Profile WHERE id = ?',
      args: [user.profileId],
    })
    if (profileResult.rows.length > 0) {
      const p = profileResult.rows[0] as any
      profile = {
        id: p.id,
        name: p.name,
        roleTier: p.roleTier,
        role: p.role,
        skills: p.skills,
        unavailable: p.unavailable,
      }
    }
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileId: user.profileId,
      profile,
    },
  })
  res.cookies.set('ra-user-id', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
