/**
 * Email notification service using Resend.
 * If RESEND_API_KEY is not set, emails are silently skipped (dev mode).
 */

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
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) console.error('[email] Failed:', await res.text())
  } catch (e: any) {
    console.error('[email] Error:', e.message)
  }
}

export async function notifyAssignmentCreated(profileId: string, eventName: string, date: string, shirtColor?: string | null) {
  const { db } = await import('./db')
  const result = await db.execute({
    sql: `SELECT u.email FROM User u WHERE u.profileId = ? AND u.email IS NOT NULL`,
    args: [profileId],
  })
  if (result.rows.length === 0) return
  const email = result.rows[0].email as string
  await sendEmail(email, `New assignment: ${eventName}`,
    `<h2>📅 New Assignment</h2><p><strong>${eventName}</strong> on ${date}${shirtColor ? `<br>Shirt: ${shirtColor}` : ''}</p>`)
}

export async function notifyAssignmentRemoved(profileId: string, eventName: string, date: string) {
  const { db } = await import('./db')
  const result = await db.execute({
    sql: `SELECT u.email FROM User u WHERE u.profileId = ? AND u.email IS NOT NULL`,
    args: [profileId],
  })
  if (result.rows.length === 0) return
  const email = result.rows[0].email as string
  await sendEmail(email, `Assignment removed: ${eventName}`,
    `<p>Your assignment to <strong>${eventName}</strong> on ${date} has been removed.</p>`)
}

export async function notifyOptInReceived(userName: string, status: string, eventName: string) {
  const { db } = await import('./db')
  const result = await db.execute({
    sql: `SELECT email FROM User WHERE role = 'admin' AND email IS NOT NULL`,
  })
  for (const row of result.rows) {
    await sendEmail(row.email as string, `${userName} ${status}: ${eventName}`,
      `<p><strong>${userName}</strong> marked themselves as <strong>${status}</strong> for ${eventName}.</p>`)
  }
}

export async function sendReminders() {
  if (!RESEND_API_KEY) return { sent: 0, skipped: true }
  const { db } = await import('./db')
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Barbados', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const d = new Date(today + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + 2)
  const targetDate = d.toISOString().slice(0, 10)

  const assignments = await db.execute({
    sql: `SELECT a.*, e.name as eventName, e.location, e.startTime, u.email, p.name as profileName
          FROM Assignment a JOIN Event e ON a.eventId = e.id
          JOIN User u ON u.profileId = a.profileId JOIN Profile p ON p.id = a.profileId
          WHERE a.assignedDate = ? AND u.email IS NOT NULL`,
    args: [targetDate + 'T00:00:00.000Z'],
  })

  let sent = 0
  for (const a of assignments.rows as any[]) {
    await sendEmail(a.email, `Reminder: ${a.eventName} in 2 days`,
      `<h2>⏰ Reminder</h2><p>You're assigned to <strong>${a.eventName}</strong> on ${targetDate} at ${a.startTime}.${a.location ? ` Location: ${a.location}.` : ''}${a.shirtColor ? ` Shirt: ${a.shirtColor}.` : ''}</p>`)
    sent++
  }
  return { sent, skipped: false }
}
