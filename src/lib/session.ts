/**
 * Signed session management using Web Crypto API.
 * Works in both browser and Node.js (serverless).
 */

import type { NextRequest } from 'next/server'
import type { NextResponse } from 'next/server'

export interface SessionData {
  userId?: string
}

const COOKIE_NAME = 'ra-session'
const SECRET = process.env.SESSION_PASSWORD || 'changeme-this-must-be-at-least-32-characters-long!!'

async function hmac(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sign(userId: string): Promise<string> {
  return `${userId}.${await hmac(userId)}`
}

async function verify(token: string): Promise<string | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [userId, providedHmac] = parts
  if (providedHmac !== await hmac(userId)) return null
  return userId
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionData> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return {}
  const userId = await verify(token)
  return userId ? { userId } : {}
}

export async function saveSessionToResponse(res: NextResponse, data: SessionData): Promise<void> {
  if (!data.userId) return
  const token = await sign(data.userId)
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, path: '/',
  })
}

export function clearSession(res: NextResponse): void {
  res.cookies.delete(COOKIE_NAME)
}
