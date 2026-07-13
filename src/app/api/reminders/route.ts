import { NextResponse } from 'next/server'
import { sendReminders, sendDigests } from '@/lib/email'

// POST /api/reminders — sends 2-day reminder emails + flushes digest queue.
//
// ANTI-SPAM GUARDS (in sendReminders):
// 1. Checks ENABLE_AUTOMATIC_EMAILS env var (kill switch)
// 2. DB idempotency: queries EmailQueue for reminders already sent for this date
// 3. Respects per-user emailNotifications toggle
// 4. Only called by Vercel Cron (once/day) — NOT called by fetchSchedule()
//
// To enable: set ENABLE_AUTOMATIC_EMAILS=1 in Vercel env vars + add Vercel Cron:
//   { "path": "/api/reminders", "schedule": "0 8 * * *" }

export async function POST() {
  try {
    const [reminders, digests] = await Promise.all([
      sendReminders(),
      sendDigests(),
    ])
    return NextResponse.json({
      reminders: reminders.sent,
      digests: digests.sent,
      skipped: reminders.skipped || digests.skipped,
    })
  } catch (e: any) {
    console.error('Reminders error:', e.message)
    return NextResponse.json({ reminders: 0, digests: 0, error: e.message }, { status: 500 })
  }
}
