import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getAuthUser } from '@/lib/auth-helpers'

// POST /api/auth/change-password
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { currentPassword, newPassword } = body as { currentPassword: string; newPassword: string }
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: 'No password set on account' }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  await db.execute({ sql: 'UPDATE User SET passwordHash = ? WHERE id = ?', args: [newHash, user.id] })

  return NextResponse.json({ ok: true })
}
