/**
 * Email notification service using Resend + digest queue.
 *
 * Two urgency levels:
 *   - 'instant'  → sent immediately (opt-in receipts, verification codes, <72h assignment changes)
 *   - 'digest'   → queued, sent in 8am AST digest or when admin clicks "Send now"
 *
 * Per-user email toggle (User.emailNotifications):
 *   - 0 → no emails (notifications still appear in the bell)
 *   - 1 → emails (default)
 *   - Verification codes + welcome emails bypass the toggle (transactional)
 *
 * If RESEND_API_KEY is not set, everything is silently skipped (dev mode).
 */

import "server-only"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'
const URGENT_HOURS = 72 // changes to events within this window fire instantly

// ---------- Low-level send ----------

/** Escape user-supplied text for safe interpolation into HTML email bodies. */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log('[email] Skipped (no RESEND_API_KEY):', subject, '→', to)
    return false
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

// ---------- Event date urgency check ----------

async function isEventUrgent(eventId: string): Promise<boolean> {
  const { db } = await import('./db')
  const r = await db.execute({
    sql: 'SELECT startDate FROM Event WHERE id = ?',
    args: [eventId],
  })
  if (r.rows.length === 0) return false
  const startDate = String((r.rows[0] as any).startDate).slice(0, 10)
  // Today in Barbados
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Barbados', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const diffMs = new Date(startDate + 'T00:00:00.000Z').getTime() - new Date(today + 'T00:00:00.000Z').getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours >= 0 && diffHours <= URGENT_HOURS * 24
}

// ---------- Notification + Email queue ----------

/**
 * Create an in-app notification AND queue an email if appropriate.
 * Called by assignment/opt-in handlers.
 *
 * @param userId     recipient user
 * @param type       notification type ('assignment_created' | 'assignment_removed' | 'opt_in_received' | 'event_changed')
 * @param title      short title
 * @param body       longer body (optional)
 * @param eventId    related event (optional, makes notification clickable)
 * @param assignmentId  related assignment (optional)
 * @param urgency    'instant' | 'digest' (default 'digest')
 * @param alwaysEmail  if true, ignore user's emailNotifications toggle (for transactional emails)
 */
export async function notifyUser(opts: {
  userId: string
  type: string
  title: string
  body?: string | null
  eventId?: string | null
  assignmentId?: string | null
  urgency?: 'instant' | 'digest'
  alwaysEmail?: boolean
  emailSubject?: string
  emailHtml?: string
}) {
  const { db } = await import('./db')
  const { userId, type, title, body, eventId, assignmentId, urgency = 'digest', alwaysEmail = false } = opts

  // 1. Always create the in-app notification (bell)
  await db.execute({
    sql: `INSERT INTO Notification (id, userId, type, title, body, eventId, assignmentId, readAt, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`,
    args: [crypto.randomUUID(), userId, type, title, body ?? null, eventId ?? null, assignmentId ?? null],
  }).catch(() => {
    // Notification table might not exist yet (pre-migration). Silently skip.
    console.log('[notify] Notification table missing — skipping in-app notification')
  })

  // 2. Queue the email if user has email notifications on (or alwaysEmail=true)
  const prefs = await getUserEmailAndPrefs(userId)
  if (!prefs || !prefs.email) return // no email address → can't email
  if (!alwaysEmail && !prefs.emailNotifications) return // user opted out

  // Capture the queue row id so we can reliably mark it sent (datetime('now') has
  // 1-second precision and would otherwise fail to match after the sendEmail HTTP call)
  const emailQueueId = crypto.randomUUID()
  await db.execute({
    sql: `INSERT INTO EmailQueue (id, userId, type, subject, body, eventId, urgency, sentAt, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`,
    args: [
      emailQueueId,
      userId,
      type,
      opts.emailSubject ?? title,
      opts.emailHtml ?? `<p>${body ?? title}</p>`,
      eventId ?? null,
      urgency,
    ],
  }).catch(() => {
    console.log('[notify] EmailQueue table missing — skipping email queue')
  })

  // 3. If urgency is 'instant', send immediately and mark the row sent by id
  if (urgency === 'instant') {
    await sendEmail(prefs.email, opts.emailSubject ?? title, opts.emailHtml ?? `<p>${body ?? title}</p>`)
    await db.execute({
      sql: "UPDATE EmailQueue SET sentAt = datetime('now') WHERE id = ?",
      args: [emailQueueId],
    }).catch(() => {})
  }
}

// ---------- High-level notification helpers ----------

export async function notifyAssignmentCreated(profileId: string, eventName: string, date: string, shirtColor: string | null, eventId: string | null) {
  const userId = await getUserIdByProfileId(profileId)
  if (!userId) return

  const urgent = eventId ? await isEventUrgent(eventId) : false
  const title = `New assignment: ${eventName}`
  const body = `You've been assigned to ${eventName} on ${date}${shirtColor ? `. Shirt: ${shirtColor}` : ''}.`
  const html = `<h2>📅 New Assignment</h2><p><strong>${escapeHtml(eventName)}</strong> on ${escapeHtml(date)}${shirtColor ? `<br>Shirt: ${escapeHtml(shirtColor)}` : ''}</p>`

  await notifyUser({
    userId,
    type: 'assignment_created',
    title,
    body,
    eventId,
    urgency: urgent ? 'instant' : 'digest',
    emailSubject: title,
    emailHtml: html,
  })
}

export async function notifyAssignmentRemoved(profileId: string, eventName: string, date: string, eventId: string | null) {
  const userId = await getUserIdByProfileId(profileId)
  if (!userId) return

  const urgent = eventId ? await isEventUrgent(eventId) : false
  const title = `Assignment removed: ${eventName}`
  const body = `Your assignment to ${eventName} on ${date} has been removed.`
  const html = `<p>Your assignment to <strong>${escapeHtml(eventName)}</strong> on ${escapeHtml(date)} has been removed.</p>`

  await notifyUser({
    userId,
    type: 'assignment_removed',
    title,
    body,
    eventId,
    urgency: urgent ? 'instant' : 'digest',
    emailSubject: title,
    emailHtml: html,
  })
}

export async function notifyOptInReceived(userName: string, status: string, eventName: string, eventId: string | null) {
  // Notify all admins
  const adminIds = await getAdminUserIds()
  const title = `${userName} ${status}: ${eventName}`
  const body = `${userName} marked themselves as ${status} for ${eventName}.`
  const html = `<p><strong>${escapeHtml(userName)}</strong> marked themselves as <strong>${escapeHtml(status)}</strong> for ${escapeHtml(eventName)}.</p>`

  await Promise.all(adminIds.map(adminId =>
    notifyUser({
      userId: adminId,
      type: 'opt_in_received',
      title,
      body,
      eventId,
      urgency: 'instant', // opt-ins are always instant — instructors expect immediate feedback
      emailSubject: title,
      emailHtml: html,
    })
  ))
}

// ---------- Digest + manual send ----------

/**
 * Send all pending digest emails for a user.
 * Groups by user, concatenates body into a single digest email.
 */
export async function sendDigests() {
  if (!RESEND_API_KEY) return { sent: 0, skipped: true }
  const { db } = await import('./db')

  // Find users with pending digest emails
  let pending
  try {
    pending = await db.execute({
      sql: `SELECT DISTINCT userId FROM EmailQueue WHERE sentAt IS NULL AND urgency = 'digest'`,
    })
  } catch (e: any) {
    console.warn('[email] EmailQueue table missing — digest skipped:', e.message)
    return { sent: 0, skipped: true }
  }

  let sent = 0
  for (const row of pending.rows as any[]) {
    const userId = row.userId
    const prefs = await getUserEmailAndPrefs(userId)
    if (!prefs || !prefs.email || !prefs.emailNotifications) continue

    // Get all pending digest items for this user
    const items = await db.execute({
      sql: `SELECT * FROM EmailQueue WHERE userId = ? AND sentAt IS NULL AND urgency = 'digest' ORDER BY createdAt ASC`,
      args: [userId],
    })

    if (items.rows.length === 0) continue

    // Build digest email
    const html = `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">RA Syncbot — Daily Digest</h2>
      <p>You have ${items.rows.length} update${items.rows.length > 1 ? 's' : ''}:</p>
      <ul>
        ${items.rows.map((i: any) => `<li><strong>${escapeHtml(i.subject)}</strong><br><span style="color: #666; font-size: 12px;">${escapeHtml(i.body)}</span></li>`).join('')}
      </ul>
      <p style="color: #666; font-size: 11px; margin-top: 20px;">Log in to <a href="https://ra-syncbot.com">ra-syncbot.com</a> to view details.</p>
    </div>`

    const success = await sendEmail(prefs.email, `RA Syncbot — ${items.rows.length} update${items.rows.length > 1 ? 's' : ''} today`, html)
    if (success) {
      // Mark all as sent
      await db.execute({
        sql: "UPDATE EmailQueue SET sentAt = datetime('now') WHERE userId = ? AND sentAt IS NULL AND urgency = 'digest'",
        args: [userId],
      })
      sent++
    }
  }

  return { sent, skipped: false }
}

/**
 * Send ALL pending emails (digest + instant) immediately.
 * Called when admin clicks "Send pending notifications now".
 */
export async function sendAllPending() {
  if (!RESEND_API_KEY) return { sent: 0, skipped: true }
  const { db } = await import('./db')

  let pending
  try {
    pending = await db.execute({
      sql: `SELECT DISTINCT userId FROM EmailQueue WHERE sentAt IS NULL`,
    })
  } catch (e: any) {
    console.warn('[email] EmailQueue table missing — send-now skipped:', e.message)
    return { sent: 0, skipped: true }
  }

  let sent = 0
  for (const row of pending.rows as any[]) {
    const userId = row.userId
    const prefs = await getUserEmailAndPrefs(userId)
    if (!prefs || !prefs.email || !prefs.emailNotifications) continue

    const items = await db.execute({
      sql: `SELECT * FROM EmailQueue WHERE userId = ? AND sentAt IS NULL ORDER BY createdAt ASC`,
      args: [userId],
    })

    if (items.rows.length === 0) continue

    const html = `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">RA Syncbot — Update</h2>
      <p>You have ${items.rows.length} update${items.rows.length > 1 ? 's' : ''}:</p>
      <ul>
        ${items.rows.map((i: any) => `<li><strong>${escapeHtml(i.subject)}</strong><br><span style="color: #666; font-size: 12px;">${escapeHtml(i.body)}</span></li>`).join('')}
      </ul>
    </div>`

    const success = await sendEmail(prefs.email, `RA Syncbot — ${items.rows.length} update${items.rows.length > 1 ? 's' : ''}`, html)
    if (success) {
      await db.execute({
        sql: "UPDATE EmailQueue SET sentAt = datetime('now') WHERE userId = ? AND sentAt IS NULL",
        args: [userId],
      })
      sent++
    }
  }

  return { sent, skipped: false }
}

// ---------- Reminders (unchanged behavior, instant) ----------

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
    sql: `SELECT a.*, e.name as eventName, e.location, e.startTime, e.id as eventId, u.email, u.id as userId, u.emailNotifications, p.name as profileName
          FROM Assignment a JOIN Event e ON a.eventId = e.id
          JOIN User u ON u.profileId = a.profileId JOIN Profile p ON p.id = a.profileId
          WHERE a.assignedDate = ? AND u.email IS NOT NULL`,
    args: [targetDate + 'T00:00:00.000Z'],
  })

  let sent = 0
  for (const a of assignments.rows as any[]) {
    const emailOn = a.emailNotifications === null || a.emailNotifications === undefined ? true : !!a.emailNotifications
    if (!emailOn) continue
    const html = `<h2>⏰ Reminder</h2><p>You're assigned to <strong>${escapeHtml(a.eventName)}</strong> on ${escapeHtml(targetDate)} at ${escapeHtml(a.startTime)}.${a.location ? ` Location: ${escapeHtml(a.location)}.` : ''}${a.shirtColor ? ` Shirt: ${escapeHtml(a.shirtColor)}.` : ''}</p>`
    const success = await sendEmail(a.email, `Reminder: ${a.eventName} in 2 days`, html)
    if (success) sent++
  }
  return { sent, skipped: false }
}
