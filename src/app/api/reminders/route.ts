import { NextResponse } from 'next/server'
import { sendReminders, sendDigests } from '@/lib/email'

// POST /api/reminders — sends email reminders for assignments 2 days away,
// AND sends the daily digest of pending notifications.
//
// This endpoint is INTENTIONALLY DISABLED to prevent email spam.
// It was previously called on every schedule refetch (5+ times/minute).
//
// To send emails, use the "Send Now" button in the admin top bar instead
// (POST /api/notifications/send-now), which flushes the digest queue manually.
//
// To re-enable automatic reminders, set ENABLE_AUTOMATIC_EMAILS=1 in env vars
// and configure a Vercel Cron job to hit this endpoint once per day.

export async function POST() {
  // Kill switch — if not explicitly enabled, do nothing
  if (process.env.ENABLE_AUTOMATIC_EMAILS !== '1') {
    return NextResponse.json({
      reminders: 0,
      digests: 0,
      skipped: true,
      reason: 'Automatic emails are disabled. Use the Send Now button or set ENABLE_AUTOMATIC_EMAILS=1 to enable cron-based emails.',
    })
  }

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
    return NextResponse.json({ reminders: 0, digests: 0, error: e.message }, { status: 500 })
  }
}
