/**
 * RA Syncbot — Email notification service (Resend + digest queue)
 *
 * ARCHITECTURE:
 *
 * notifyUser()         → creates bell notification + queues email (never sends)
 * sendAllPending()     → flushes queue (Send Now button, manual only)
 * sendReminders()      → sends 2-day reminders directly (DB-idempotent via Assignment.reminderSentAt)
 * sendDigests()        → disabled (no-op, use Send Now instead)
 * sendEmail()          → low-level Resend API call
 * claim/route.ts       → calls sendEmail() directly for verification codes + welcome
 *
 * ANTI-SPAM GUARANTEES:
 * 1. notifyUser() NEVER calls sendEmail() — only queues to EmailQueue
 * 2. sendReminders() has 4 layers: env kill switch + API key check +
 *    per-user toggle + Assignment.reminderSentAt column (hard idempotency)
 * 3. /api/reminders is NOT called by any client component
 * 4. fetchSchedule() does NOT call /api/reminders
 * 5. All email functions respect User.emailNotifications toggle (except claim flow)
 * 6. sendAllPending() (Send Now) respects toggle + marks rows sent after sending
 */

import "server-only"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'

// ---------- Low-level send ----------

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] Failed:', await res.text())
      return false
    }
    return true
  } catch (e: any) {
    console.error('[email] Error:', e.message)
    return false
  }
}

// ---------- User lookup helpers ----------

async function getUserEmailAndPrefs(userId: string): Promise<{ email: string | null; emailNotifications: boolean } | null> {
  const { db } = await import('./db')
  const r = await db.execute({
    sql: 'SELECT email, emailNotifications FROM User WHERE id = ?',
    args: [userId],
  })
  if (r.rows.length === 0) return null
  const u = r.rows[0] as any
  return {
    email: u.email ?? null,
    emailNotifications: u.emailNotifications === null || u.emailNotifications === undefined ? true : !!u.emailNotifications,
  }
}

async function getUserIdByProfileId(profileId: string): Promise<string | null> {
  const { db } = await import('./db')
  const r = await db.execute({
    sql: 'SELECT id FROM User WHERE profileId = ?',
    args: [profileId],
  })
  if (r.rows.length === 0) return null
  return (r.rows[0] as any).id
}

async function getAdminUserIds(): Promise<string[]> {
  const { db } = await import('./db')
  const r = await db.execute({ sql: "SELECT id FROM User WHERE role = 'admin'" })
  return r.rows.map((u: any) => u.id)
}

// ---------- notifyUser (bell + queue, NEVER sends email) ----------

export async function notifyUser(opts: {
  userId: string
  type: string
  title: string
  body?: string | null
  eventId?: string | null
  assignmentId?: string | null
  urgency?: 'instant' | 'digest'
  emailSubject?: string
  emailHtml?: string
}) {
  const { db } = await import('./db')
  const { userId, type, title, body, eventId, assignmentId } = opts

  // 1. Always create the in-app notification (bell)
  await db.execute({
    sql: `INSERT INTO Notification (id, userId, type, title, body, eventId, assignmentId, readAt, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`,
    args: [crypto.randomUUID(), userId, type, title, body ?? null, eventId ?? null, assignmentId ?? null],
  }).catch(() => {})

  // 2. Queue the email if user has email notifications on
  const prefs = await getUserEmailAndPrefs(userId)
  if (!prefs || !prefs.email) return
  if (!prefs.emailNotifications) return

  await db.execute({
    sql: `INSERT INTO EmailQueue (id, userId, type, subject, body, eventId, urgency, sentAt, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`,
    args: [
      crypto.randomUUID(), userId, type,
      opts.emailSubject ?? title,
      opts.emailHtml ?? `<p>${body ?? title}</p>`,
      eventId ?? null,
      opts.urgency ?? 'digest',
    ],
  }).catch(() => {})

  // NEVER calls sendEmail() — emails wait for Send Now button
}

// ---------- High-level notification helpers ----------

export async function notifyAssignmentCreated(profileId: string, eventName: string, date: string, shirtColor: string | null, eventId: string | null) {
  const userId = await getUserIdByProfileId(profileId)
  if (!userId) return
  const title = `New assignment: ${eventName}`
  const body = `You've been assigned to ${eventName} on ${date}${shirtColor ? `. Shirt: ${shirtColor}` : ''}.`
  const html = `<h2>📅 New Assignment</h2><p><strong>${escapeHtml(eventName)}</strong> on ${escapeHtml(date)}${shirtColor ? `<br>Shirt: ${escapeHtml(shirtColor)}` : ''}</p>`
  await notifyUser({ userId, type: 'assignment_created', title, body, eventId, emailSubject: title, emailHtml: html })
}

export async function notifyAssignmentRemoved(profileId: string, eventName: string, date: string, eventId: string | null) {
  const userId = await getUserIdByProfileId(profileId)
  if (!userId) return
  const title = `Assignment removed: ${eventName}`
  const body = `Your assignment to ${eventName} on ${date} has been removed.`
  const html = `<p>Your assignment to <strong>${escapeHtml(eventName)}</strong> on ${escapeHtml(date)} has been removed.</p>`
  await notifyUser({ userId, type: 'assignment_removed', title, body, eventId, emailSubject: title, emailHtml: html })
}

export async function notifyOptInReceived(userName: string, status: string, eventName: string, eventId: string | null) {
  const adminIds = await getAdminUserIds()
  const title = `${userName} ${status}: ${eventName}`
  const body = `${userName} marked themselves as ${status} for ${eventName}.`
  const html = `<p><strong>${escapeHtml(userName)}</strong> marked themselves as <strong>${escapeHtml(status)}</strong> for ${escapeHtml(eventName)}.</p>`
  await Promise.all(adminIds.map(adminId =>
    notifyUser({ userId: adminId, type: 'opt_in_received', title, body, eventId, emailSubject: title, emailHtml: html })
  ))
}

// ---------- sendAllPending (Send Now button — manual only) ----------

export async function sendAllPending() {
  if (!RESEND_API_KEY) return { sent: 0, skipped: true }
  const { db } = await import('./db')

  let pending
  try {
    pending = await db.execute({ sql: `SELECT DISTINCT userId FROM EmailQueue WHERE sentAt IS NULL` })
  } catch {
    return { sent: 0, skipped: true }
  }

  let sent = 0
  for (const row of pending.rows as any[]) {
    const prefs = await getUserEmailAndPrefs(row.userId)
    if (!prefs?.email || !prefs.emailNotifications) continue

    const items = await db.execute({
      sql: `SELECT * FROM EmailQueue WHERE userId = ? AND sentAt IS NULL ORDER BY createdAt ASC`,
      args: [row.userId],
    })
    if (items.rows.length === 0) continue

    const html = `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">RA Syncbot — Update</h2>
      <p>You have ${items.rows.length} update${items.rows.length > 1 ? 's' : ''}:</p>
      <ul>
        ${items.rows.map((i: any) => `<li><strong>${escapeHtml(i.subject)}</strong><br><span style="color: #666; font-size: 12px;">${escapeHtml(i.body)}</span></li>`).join('')}
      </ul>
    </div>`

    if (await sendEmail(prefs.email, `RA Syncbot — ${items.rows.length} update${items.rows.length > 1 ? 's' : ''}`, html)) {
      await db.execute({
        sql: "UPDATE EmailQueue SET sentAt = datetime('now') WHERE userId = ? AND sentAt IS NULL",
        args: [row.userId],
      })
      sent++
    }
  }
  return { sent, skipped: false }
}

// ---------- sendDigests (disabled — use Send Now instead) ----------

export async function sendDigests() {
  return { sent: 0, skipped: true }
}

// ---------- sendReminders (2-day reminders, hard DB idempotency) ----------

export async function sendReminders() {
  if (!RESEND_API_KEY) return { sent: 0, skipped: true }
  if (process.env.ENABLE_AUTOMATIC_EMAILS !== '1') return { sent: 0, skipped: true }
  const { db } = await import('./db')

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Barbados', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const d = new Date(today + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + 2)
  const targetDate = d.toISOString().slice(0, 10)

  // HARD IDEMPOTENCY: only select assignments where reminderSentAt IS NULL
  // This column is set on the Assignment row itself — no separate table lookup needed.
  // Even if this function is called 1000 times, each assignment gets exactly 1 reminder.
  let assignments
  try {
    assignments = await db.execute({
      sql: `SELECT a.id as assignmentId, a.shirtColor, a.assignedDate,
            e.name as eventName, e.location, e.startTime,
            u.email, u.id as userId, u.emailNotifications
            FROM Assignment a
            JOIN Event e ON a.eventId = e.id
            JOIN User u ON u.profileId = a.profileId
            WHERE a.assignedDate = ? AND u.email IS NOT NULL
            AND a.reminderSentAt IS NULL`,
      args: [targetDate + 'T00:00:00.000Z'],
    })
  } catch {
    // reminderSentAt column might not exist — try adding it
    try {
      await db.execute({ sql: 'ALTER TABLE Assignment ADD COLUMN reminderSentAt TEXT' })
    } catch {}
    // Retry the query
    assignments = await db.execute({
      sql: `SELECT a.id as assignmentId, a.shirtColor, a.assignedDate,
            e.name as eventName, e.location, e.startTime,
            u.email, u.id as userId, u.emailNotifications
            FROM Assignment a
            JOIN Event e ON a.eventId = e.id
            JOIN User u ON u.profileId = a.profileId
            WHERE a.assignedDate = ? AND u.email IS NOT NULL
            AND a.reminderSentAt IS NULL`,
      args: [targetDate + 'T00:00:00.000Z'],
    })
  }

  let sent = 0
  for (const a of assignments.rows as any[]) {
    const emailOn = a.emailNotifications === null || a.emailNotifications === undefined ? true : !!a.emailNotifications
    if (!emailOn) continue

    const html = `<h2>⏰ Reminder</h2><p>You're assigned to <strong>${escapeHtml(a.eventName)}</strong> on ${escapeHtml(targetDate)} at ${escapeHtml(a.startTime)}.${a.location ? ` Location: ${escapeHtml(a.location)}.` : ''}${a.shirtColor ? ` Shirt: ${escapeHtml(a.shirtColor)}.` : ''}</p>`

    const success = await sendEmail(a.email, `Reminder: ${a.eventName} in 2 days`, html)

    // HARD IDEMPOTENCY: mark the assignment row so it can NEVER be re-sent
    if (success) {
      try {
        await db.execute({
          sql: "UPDATE Assignment SET reminderSentAt = datetime('now') WHERE id = ?",
          args: [a.assignmentId],
        })
      } catch {}
      sent++
    }
  }
  return { sent, skipped: false }
}
