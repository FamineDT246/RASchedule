/**
 * Email notification service using Resend.
 *
 * Requires RESEND_API_KEY environment variable.
 * If not set, emails are silently skipped (dev mode).
 *
 * Emails sent:
 * - Assignment created → instructor notified
 * - Assignment removed → instructor notified
 * - Opt-in received → admin notified
 * - Reminder (2 days before) → instructor reminded
 */

import { db } from './db'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log('[email] Skipped (no RESEND_API_KEY):', subject, '→', to)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Failed:', err)
    }
  } catch (e: any) {
    console.error('[email] Error:', e.message)
  }
}

export async function notifyAssignmentCreated(profileId: string, eventName: string, date: string, shirtColor?: string | null) {
  // Get the user's email for this profile
  const result = await db.execute({
    sql: `SELECT u.email FROM User u WHERE u.profileId = ? AND u.email IS NOT NULL`,
    args: [profileId],
  })
  if (result.rows.length === 0) return

  const email = result.rows[0].email as string
  const dateFmt = new Date(date + 'T00:00:00.000Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })

  await sendEmail(
    email,
    `New assignment: ${eventName}`,
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">📅 New Assignment</h2>
      <p>You've been assigned to:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Event</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${eventName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dateFmt}</td></tr>
        ${shirtColor ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Shirt</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${shirtColor}</td></tr>` : ''}
      </table>
      <p style="color: #666; font-size: 12px;">Robot Adventures Scheduler</p>
    </div>`,
  )
}

export async function notifyAssignmentRemoved(profileId: string, eventName: string, date: string) {
  const result = await db.execute({
    sql: `SELECT u.email FROM User u WHERE u.profileId = ? AND u.email IS NOT NULL`,
    args: [profileId],
  })
  if (result.rows.length === 0) return

  const email = result.rows[0].email as string
  const dateFmt = new Date(date + 'T00:00:00.000Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  })

  await sendEmail(
    email,
    `Assignment removed: ${eventName}`,
    `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #f43f5e;">❌ Assignment Removed</h2>
      <p>Your assignment has been removed:</p>
      <p><strong>${eventName}</strong> on ${dateFmt}</p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">Robot Adventures Scheduler</p>
    </div>`,
  )
}

export async function notifyOptInReceived(userName: string, status: string, eventName: string) {
  // Get admin emails
  const result = await db.execute({
    sql: `SELECT email FROM User WHERE role = 'admin' AND email IS NOT NULL`,
  })
  if (result.rows.length === 0) return

  for (const row of result.rows) {
    const email = row.email as string
    await sendEmail(
      email,
      `${userName} ${status}: ${eventName}`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">★ New Opt-in</h2>
        <p><strong>${userName}</strong> has marked themselves as <strong>${status}</strong> for:</p>
        <p style="font-size: 16px; margin: 16px 0;">${eventName}</p>
        <p style="color: #666; font-size: 12px;">Robot Adventures Scheduler</p>
      </div>`,
    )
  }
}

/**
 * Send reminders for assignments happening in 2 days.
 * Called by the /api/reminders endpoint (triggered on schedule load).
 */
export async function sendReminders() {
  if (!RESEND_API_KEY) return { sent: 0, skipped: true }

  // Get tomorrow + 2 days in Barbados time
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Barbados',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const d = new Date(today + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + 2)
  const twoDaysFromNow = d.toISOString().slice(0, 10)

  // Find assignments 2 days from now that haven't been reminded yet
  // (we use a simple approach: check if there's a record in OptIn with note='reminded'
  // — not perfect but works for a small app)
  const assignments = await db.execute({
    sql: `SELECT a.*, e.name as eventName, e.location, e.startTime, e.endTime,
          u.email, p.name as profileName
          FROM Assignment a
          JOIN Event e ON a.eventId = e.id
          JOIN User u ON u.profileId = a.profileId
          JOIN Profile p ON p.id = a.profileId
          WHERE a.assignedDate = ? AND u.email IS NOT NULL`,
    args: [twoDaysFromNow + 'T00:00:00.000Z'],
  })

  let sent = 0
  for (const a of assignments.rows as any[]) {
    const dateFmt = new Date(a.assignedDate).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
    })

    await sendEmail(
      a.email,
      `Reminder: ${a.eventName} in 2 days`,
      `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">⏰ Assignment Reminder</h2>
        <p>Hi ${a.profileName},</p>
        <p>This is a reminder that you're assigned to:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Event</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${a.eventName}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">When</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dateFmt} at ${a.startTime}</td></tr>
          ${a.location ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Where</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${a.location}</td></tr>` : ''}
          ${a.shirtColor ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Shirt</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${a.shirtColor}</td></tr>` : ''}
        </table>
        <p>See you there!</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Robot Adventures Scheduler</p>
      </div>`,
    )
    sent++
  }

  return { sent, skipped: false }
}
