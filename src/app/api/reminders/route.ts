import { NextResponse } from 'next/server'
import { sendReminders } from '@/lib/email'

// POST /api/reminders — sends email reminders for assignments 2 days away.
// Called automatically when the schedule loads (fire-and-forget).
export async function POST() {
  try {
    const result = await sendReminders()
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Reminders error:', e.message)
    return NextResponse.json({ sent: 0, error: e.message })
  }
}
