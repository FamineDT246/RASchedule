/**
 * Signed session management using Web Crypto API.
 *
 * Works in both browser and Node.js (serverless).
 * The cookie value is `userId.hmac(userId)` — can't be forged without the secret.
 */

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

export interface SessionData {
  userId?: string
}

const COOKIE_NAME = 'ra-session'
const SECRET = process.env.SESSION_PASSWORD || 'changeme-this-must-be-at-least-32-characters-long!!'

// Simple HMAC using Web Crypto API (works in browser + Node.js)
async function hmac(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sign(userId: string): Promise<string> {
  const h = await hmac(userId)
  return `${userId}.${h}`
}

async function verify(token: string): Promise<string | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [userId, providedHmac] = parts
  const expectedHmac = await hmac(userId)
  if (providedHmac !== expectedHmac) return null
  return userId
}

/**
 * Get the userId from a signed session cookie.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionData> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return {}
  const userId = await verify(token)
  if (!userId) return {}
  return { userId }
}

/**
 * Save a session to a NextResponse (set the signed cookie).
 */
export async function saveSessionToResponse(res: NextResponse, data: SessionData): Promise<void> {
  if (!data.userId) return
  const token = await sign(data.userId)
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

/**
 * Clear the session cookie.
 */
export function clearSession(res: NextResponse): void {
  res.cookies.delete(COOKIE_NAME)
}
