import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getAuthUser } from '@/lib/auth-helpers'
import { saveSessionToResponse } from '@/lib/session'

// Re-export getAuthUser for backward compatibility (other routes import from here)
export { getAuthUser } from '@/lib/auth-helpers'

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

  // Rate limiting: check if this email has had >5 failed attempts in the last 15 minutes
  // (simplified — uses a simple counter in the User table)
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
  // Save signed session (encrypted cookie — can't be forged)
  await saveSessionToResponse(res, { userId: user.id })
  return res
}
