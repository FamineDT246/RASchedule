import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from '@/lib/db'

// POST /api/assignments/bulk — assign to all days of an event
const authBulk = await requireAdmin(req); if (authBulk) return authBulk;
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, profileId } = body as { eventId: string; profileId: string }
  if (!eventId || !profileId) {
    return NextResponse.json({ error: 'Missing eventId or profileId' }, { status: 400 })
  }

  // Get the event
  const eventResult = await db.execute({ sql: 'SELECT * FROM Event WHERE id = ?', args: [eventId] })
  if (eventResult.rows.length === 0) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  const event = eventResult.rows[0] as any

  if (event.status === 'Draft' || event.status === 'Cancelled' || event.status === 'Archived') {
    return NextResponse.json({ error: `Cannot assign to a ${event.status} event` }, { status: 400 })
  }

  // Build the list of dates
  let dates: string[]
  if (event.specificDates) {
    dates = event.specificDates.split(',').map((s: string) => s.trim()).filter(Boolean)
  } else {
    dates = []
    const d = new Date(event.startDate)
    const end = new Date(event.endDate)
    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 1)
    }
  }

  // Block assignments on past dates
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Barbados',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  let created = 0, existing = 0, conflicts = 0, skippedPast = 0

  for (const date of dates) {
    // Skip past dates
    if (date < today) {
      skippedPast++
      continue
    }

    // Check if already assigned
    const existingResult = await db.execute({
      sql: 'SELECT id FROM Assignment WHERE eventId = ? AND profileId = ? AND assignedDate = ?',
      args: [eventId, profileId, new Date(date + 'T00:00:00.000Z').toISOString()],
    })

    if (existingResult.rows.length > 0) {
      existing++
      continue
    }

    // Create the assignment
    try {
      await db.execute({
        sql: `INSERT INTO Assignment (id, eventId, profileId, assignedDate, status, isAlternative, shirtColor, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, 'Assigned', 0, NULL, datetime('now'), datetime('now'))`,
        args: [crypto.randomUUID(), eventId, profileId, new Date(date + 'T00:00:00.000Z').toISOString()],
      })
      created++
    } catch {
      existing++
    }
  }

  return NextResponse.json({ created, existing, conflicts, skippedPast })
}
