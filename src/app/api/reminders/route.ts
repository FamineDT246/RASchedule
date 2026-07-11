import { NextResponse } from 'next/server'
import { sendReminders, sendDigests } from '@/lib/email'

// POST /api/reminders — sends email reminders for assignments 2 days away,
// AND sends the daily digest of pending notifications.
// Called automatically when the schedule loads (fire-and-forget) or by Vercel Cron.
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
    console.error('Reminders/digest error:', e.message)
    return NextResponse.json({ reminders: 0, digests: 0, error: e.message })
  }
}
