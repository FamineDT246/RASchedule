import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { saveSessionToResponse } from '@/lib/session'
import { sendEmail } from '@/lib/email'

// POST /api/auth/claim — claim an invite with password + email verification
//
// Flow:
// 1. Instructor opens invite link, enters name + email + password
// 2. We create the account but mark it as "unverified"
// 3. We send a verification email with a link containing a verification token
// 4. Instructor clicks the link → account is verified → they can log in
//
// If RESEND_API_KEY is not set, we skip verification (dev mode) and
// claim the account immediately.

const verifyCodes = new Map<string, { email: string; code: string; expires: number }>()

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, name, email, password, verifyCode } = body as {
    token: string
    name?: string
    email: string
    password: string
    verifyCode?: string
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

  // Step 1: If no verifyCode, send verification email
  if (!verifyCode) {
    // Generate a 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expires = Date.now() + 10 * 60 * 1000 // 10 minutes

    // Store the code (keyed by invite token + email)
    const key = `${token}:${email}`
    verifyCodes.set(key, { email, code, expires })

    // Send verification email
    await sendEmail(
      email,
      'Your RA Syncbot verification code',
      `<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">Email Verification</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; text-align: center; margin: 20px 0;">${code}</p>
        <p style="color: #666; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
    )

    return NextResponse.json({
      step: 'verify',
      message: 'Verification code sent to your email. Enter it to complete account setup.',
    })
  }

  // Step 2: Verify the code
  const key = `${token}:${email}`
  const stored = verifyCodes.get(key)
  if (!stored) {
    return NextResponse.json({ error: 'No verification code was sent. Please start again.' }, { status: 400 })
  }
  if (Date.now() > stored.expires) {
    verifyCodes.delete(key)
    return NextResponse.json({ error: 'Verification code has expired. Please start again.' }, { status: 410 })
  }
  if (stored.code !== verifyCode) {
    return NextResponse.json({ error: 'Incorrect verification code' }, { status: 401 })
  }

  // Code verified — create the account
  verifyCodes.delete(key)

  const passwordHash = await bcrypt.hash(password, 10)
  const updates: string[] = ['claimedAt = datetime(\'now\')', 'passwordHash = ?', 'email = ?']
  const args: unknown[] = [passwordHash, email]
  if (name) { updates.push('name = ?'); args.push(name) }
  args.push(user.id)

  await db.execute({
    sql: `UPDATE User SET ${updates.join(', ')} WHERE id = ?`,
    args,
  })

  // Send welcome email
  await sendEmail(
    email,
    'Welcome to RA Syncbot!',
    `<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Welcome to RA Syncbot!</h2>
      <p>Hi ${name || user.name},</p>
      <p>Your account has been verified and is ready to go. You can now:</p>
      <ul>
        <li>View your camp schedule</li>
        <li>Opt in to events you'd like to work</li>
        <li>Set your availability</li>
        <li>Subscribe to your calendar</li>
      </ul>
      <p>Login at any time using your email and password.</p>
    </div>`,
  )

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: name || user.name,
      email,
      role: user.role,
      profileId: user.profileId,
    },
  })
  await saveSessionToResponse(res, { userId: user.id })
  return res
}
