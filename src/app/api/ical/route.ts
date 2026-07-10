import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/ical?token=<inviteToken>
// Returns an iCal (.ics) feed of the user's assignments.
// The token is the user's inviteToken (used as a simple auth mechanism for calendar apps).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // Find the user by invite token OR user id (both work)
  const userResult = await db.execute({
    sql: `SELECT u.*, p.name as profileName FROM User u
          LEFT JOIN Profile p ON u.profileId = p.id
          WHERE (u.inviteToken = ? OR u.id = ?) AND u.claimedAt IS NOT NULL`,
    args: [token, token],
  })

  if (userResult.rows.length === 0) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  const user = userResult.rows[0] as any
  if (!user.profileId) {
    return new NextResponse('BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RA Syncbot//Scheduler//EN\nEND:VCALENDAR', {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  }

  // Get all assignments for this instructor
  const assignments = await db.execute({
    sql: `SELECT a.*, e.name as eventName, e.location, e.startTime, e.endTime,
          e.hostColor, e.setupDate, e.setupTime
          FROM Assignment a
          JOIN Event e ON a.eventId = e.id
          WHERE a.profileId = ?
          ORDER BY a.assignedDate ASC`,
    args: [user.profileId],
  })

  // Build iCal
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RA Syncbot//Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:RA Syncbot Schedule`,
  ]

  for (const a of assignments.rows as any[]) {
    const date = String(a.assignedDate).slice(0, 10)
    const startTime = a.startTime || '09:00'
    const endTime = a.endTime || '15:00'

    const dtStart = `${date.replace(/-/g, '')}T${startTime.replace(':', '')}00`
    const dtEnd = `${date.replace(/-/g, '')}T${endTime.replace(':', '')}00`

    const summary = a.isAlternative ? `[ALT] ${a.eventName}` : a.eventName
    const location = a.location || ''
    const description = [
      `Event: ${a.eventName}`,
      a.shirtColor ? `Shirt: ${a.shirtColor}` : '',
      a.isAlternative ? 'Role: Alternative' : 'Role: Primary',
    ].filter(Boolean).join('\\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@robot-adventures.scheduler`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      location ? `LOCATION:${location}` : '',
      `DESCRIPTION:${description}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="robot-adventures.ics"',
    },
  })
}
