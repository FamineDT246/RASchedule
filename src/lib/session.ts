/**
 * Simple signed session management.
 *
 * Instead of iron-session (which has issues on Vercel), we use a simple
 * HMAC-based cookie: the cookie value is `userId.hmac(userId)` where
 * hmac is computed using SESSION_PASSWORD. This can't be forged without
 * the secret.
 */

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export interface SessionData {
  userId?: string
}

const COOKIE_NAME = 'ra-session'
const SECRET = process.env.SESSION_PASSWORD || 'changeme-this-must-be-at-least-32-characters-long!!'

function sign(userId: string): string {
  const hmac = createHmac('sha256', SECRET).update(userId).digest('hex')
  return `${userId}.${hmac}`
}

function verify(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [userId, hmac] = parts
  const expectedHmac = createHmac('sha256', SECRET).update(userId).digest('hex')
  if (hmac !== expectedHmac) return null
  return userId
}

/**
 * Get the userId from a signed session cookie.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionData> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return {}
  const userId = verify(token)
  if (!userId) return {}
  return { userId }
}

/**
 * Save a session to a NextResponse (set the signed cookie).
 */
export async function saveSessionToResponse(res: NextResponse, data: SessionData): Promise<void> {
  if (!data.userId) return
  const token = sign(data.userId)
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

/**
 * Clear the session cookie.
 */
export function clearSession(res: NextResponse): void {
  res.cookies.delete(COOKIE_NAME)
}
