import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/session'

// POST /api/auth/logout — clears the signed session cookie
export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearSession(res)
  return res
}
