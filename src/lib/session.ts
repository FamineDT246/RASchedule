/**
 * Signed session management using iron-session.
 *
 * The session cookie is encrypted with SESSION_PASSWORD (env var),
 * so it can't be forged even if someone knows the user ID.
 *
 * Usage:
 *   import { getSession, saveSession, clearSession } from '@/lib/session'
 *
 *   const session = await getSession(req)
 *   if (!session.userId) return 401
 *   await saveSession(res, { userId: user.id })
 */

import { cookies } from 'next/headers'
import { getIronSession, sealData, unsealData } from 'iron-session'
import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

export interface SessionData {
  userId?: string
}

export const sessionOptions = {
  password: process.env.SESSION_PASSWORD || 'changeme-this-must-be-at-least-32-characters-long!!',
  cookieName: 'ra-session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  },
}

/**
 * Get the current session from a NextRequest (API route handler).
 * Reads the cookie directly — no headers() needed.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionData> {
  const cookie = req.cookies.get(sessionOptions.cookieName)?.value
  if (!cookie) return {}
  try {
    const data = await unsealData(cookie, { password: sessionOptions.password })
    return data as SessionData
  } catch {
    return {}
  }
}

/**
 * Save a session to a NextResponse (set the cookie).
 */
export async function saveSessionToResponse(res: NextResponse, data: SessionData): Promise<void> {
  const sealed = await sealData(data, { password: sessionOptions.password })
  res.cookies.set(sessionOptions.cookieName, sealed, sessionOptions.cookieOptions)
}

/**
 * Clear the session cookie.
 */
export function clearSession(res: NextResponse): void {
  res.cookies.delete(sessionOptions.cookieName)
}
