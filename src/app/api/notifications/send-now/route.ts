import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { sendAllPending } from '@/lib/email'

// POST /api/notifications/send-now — admin manually sends all pending digest emails.
// Useful when Jelani has finished iterating and wants to flush the queue immediately.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req); if (auth) return auth
  try {
    const result = await sendAllPending()
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Send-now error:', e.message)
    return NextResponse.json({ sent: 0, error: e.message })
  }
}
