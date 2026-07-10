import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { saveSessionToResponse } from '@/lib/session'

// POST /api/auth/claim — claim an invite with password
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, name, email, password } = body as {
    token: string
    name?: string
    email: string
    password: string
  }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const result = await db.execute({
    sql: 'SELECT * FROM User WHERE inviteToken = ?',
    args: [token],
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  }

  const user = result.rows[0] as any
  if (user.inviteExpiresAt && new Date(user.inviteExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invite link has expired' }, { status: 410 })
  }

  // Check email uniqueness
  if (email !== user.email) {
    const existing = await db.execute({ sql: 'SELECT id FROM User WHERE email = ?', args: [email] })
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const updates: string[] = ['claimedAt = datetime(\'now\')', 'passwordHash = ?', 'email = ?']
  const args: unknown[] = [passwordHash, email]
  if (name) { updates.push('name = ?'); args.push(name) }
  args.push(user.id)

  await db.execute({
    sql: `UPDATE User SET ${updates.join(', ')} WHERE id = ?`,
    args,
  })

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: name || user.name,
      email,
      role: user.role,
      profileId: user.profileId,
    },
  })
  // Save signed session
  await saveSessionToResponse(res, { userId: user.id })
  return res
}
