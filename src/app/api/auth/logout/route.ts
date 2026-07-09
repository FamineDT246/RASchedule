import { NextResponse } from 'next/server'

// POST /api/auth/logout — clears the auth cookie
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('ra-user-id')
  return res
}
