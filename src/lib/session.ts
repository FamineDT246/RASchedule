import "server-only";
import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

export interface SessionData { userId?: string }
const COOKIE_NAME = 'ra-session'
const SECRET = process.env.SESSION_PASSWORD || 'changeme-this-must-be-at-least-32-characters-long!!'

async function hmac(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionData> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return {}
  const parts = token.split('.')
  if (parts.length !== 2) return {}
  const [userId, providedHmac] = parts
  if (providedHmac !== await hmac(userId)) return {}
  return { userId }
}

export async function saveSessionToResponse(res: NextResponse, data: SessionData): Promise<void> {
  if (!data.userId) return
  const token = `${data.userId}.${await hmac(data.userId)}`
  res.cookies.set(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60*60*24*30, path: '/' })
}

export function clearSession(res: NextResponse): void { res.cookies.delete(COOKIE_NAME) }
