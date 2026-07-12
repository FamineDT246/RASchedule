/**
 * Fix instructor assignments from the Summer Schedule CSV.
 *
 * For each event:
 * - Add missing primary instructors (isAlternative=0)
 * - Add missing alternates (isAlternative=1)
 * - Remove instructors not in the CSV (for Grazettes which had wrong ones)
 * - Create the new "Island Roots Learning Camp" event
 *
 * Assigns one assignment per instructor on the event's start date.
 * The calendar CSV already has per-date assignments for multi-day events
 * (WSB, Grazettes, etc.) — this script fills in the events the calendar missed.
 */

import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

// Load profiles
const profileResult = await db.execute({ sql: 'SELECT id, name FROM Profile' })
const profiles = profileResult.rows.map((p: any) => ({
  id: p.id as string,
  firstName: (p.name as string).split(' ')[0].toLowerCase(),
}))

function findProfileId(firstName: string): string | null {
  const lower = firstName.toLowerCase().trim()
  const exact = profiles.find(p => p.firstName === lower)
  if (exact) return exact.id
  const fuzzy = profiles.find(p => p.firstName.startsWith(lower.slice(0, 3)))
  if (fuzzy) return fuzzy.id
  return null
}

// Get event by code or name
async function getEventId(search: { code?: string; namePattern?: RegExp }): Promise<string | null> {
  if (search.code) {
    const r = await db.execute({ sql: 'SELECT id FROM Event WHERE code = ?', args: [search.code] })
    if (r.rows.length > 0) return r.rows[0].id as string
  }
  if (search.namePattern) {
    const all = await db.execute({ sql: 'SELECT id, name FROM Event' })
    for (const e of all.rows as any[]) {
      if (search.namePattern.test(e.name)) return e.id
    }
  }
  return null
}

async function getEventStartDate(eventId: string): Promise<string> {
  const r = await db.execute({ sql: 'SELECT startDate FROM Event WHERE id = ?', args: [eventId] })
  return String(r.rows[0].startDate).slice(0, 10)
}

async function addAssignment(eventId: string, profileId: string, date: string, isAlt: boolean, shirtColor: string | null = null) {
  // Check if assignment already exists
  const existing = await db.execute({
    sql: 'SELECT id FROM Assignment WHERE eventId = ? AND profileId = ? AND assignedDate = ?',
    args: [eventId, profileId, new Date(date + 'T00:00:00.000Z').toISOString()],
  })
  if (existing.rows.length > 0) return // already exists

  await db.execute({
    sql: `INSERT INTO Assignment (id, eventId, profileId, assignedDate, status, isAlternative, shirtColor, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, 'Assigned', ?, ?, datetime('now'), datetime('now'))`,
    args: [
      crypto.randomUUID(),
      eventId,
      profileId,
      new Date(date + 'T00:00:00.000Z').toISOString(),
      isAlt ? 1 : 0,
      shirtColor,
    ],
  })
}

async function removeAssignment(eventId: string, profileId: string) {
  await db.execute({
    sql: 'DELETE FROM Assignment WHERE eventId = ? AND profileId = ?',
    args: [eventId, profileId],
  })
}

// ── Define the fixes ────────────────────────────────────────────────────

type Fix = {
  event: { code?: string; namePattern?: RegExp }
  addPrimaries: string[]
  addAlternates: string[]
  removePrimaries?: string[]  // instructors to remove (wrong assignments)
  createIfMissing?: { name: string; code: string; host: string; hostColor: string; location: string | null; startDate: string; endDate: string; startTime: string; endTime: string }
}

const fixes: Fix[] = [
  {
    event: { code: 'WSB-1' },
    addPrimaries: [],
    addAlternates: ['Ceejay', 'Rashawn', 'Owen'],
  },
  {
    event: { code: 'WSB-2' },
    addPrimaries: [],
    addAlternates: ['Taria', 'Owen', 'Ceejay', 'Cleopatra', 'Annison', 'Terje'],
  },
  {
    event: { namePattern: /exhibition/i },
    addPrimaries: [],
    addAlternates: ['Ceejay', 'Cleopatra', 'Terje'],
  },
  {
    event: { code: 'MEdT-4' }, // True Blue Summer
    addPrimaries: ['Alvin', 'Chloe', 'Nathan', 'Cheryse', 'deVere', 'Annison', 'Krea', 'Cleopatra', 'Terje'],
    addAlternates: [],
  },
  {
    event: { code: 'MYSCE-5' },
    addPrimaries: ['Chloe', 'Owen', 'Ceejay', 'Terrence', 'Cleopatra', 'Annison', 'Krea', 'Terje'],
    addAlternates: [],
  },
  {
    event: { code: 'MYSCE-6' },
    addPrimaries: ['Chloe', 'Owen', 'Ceejay', 'Terrence', 'Cleopatra', 'Annison', 'Krea', 'Terje'],
    addAlternates: [],
  },
  {
    event: { code: 'MYSCE-7' },
    addPrimaries: ['Chloe', 'Owen', 'Ceejay', 'Terrence', 'Cleopatra', 'Annison', 'Krea', 'Terje'],
    addAlternates: [],
  },
  {
    event: { code: 'MYSCE-8' },
    addPrimaries: ['Chloe', 'Owen', 'Ceejay', 'Terrence', 'Cleopatra', 'Annison', 'Krea', 'Terje'],
    addAlternates: [],
  },
  {
    event: { code: 'MYSCE-9' },
    addPrimaries: ['Chloe', 'Owen', 'Ceejay', 'Terrence', 'Cleopatra', 'Annison', 'Krea', 'Terje'],
    addAlternates: [],
  },
  {
    event: { code: 'LPK-10' }, // Liliplum Workshop 1
    addPrimaries: ['Alvin'],
    addAlternates: ['Michaela', 'Cleopatra'],
  },
  {
    event: { code: 'LPK-11' }, // Liliplum Workshop 2
    addPrimaries: ['Cheryse', 'Michaela', 'Cleopatra'],
    addAlternates: [],
  },
  {
    event: { namePattern: /st\.?\s*giles/i },
    addPrimaries: ['Nathan', 'Ormalleo', 'Ceejay', 'Michaela'],
    addAlternates: ['Alvin', 'Cheryse', 'Owen'],
  },
  {
    event: { code: 'DYC-14' }, // National Youth Day
    addPrimaries: ['Nathan', 'Ormalleo', 'Owen', 'Michaela', 'Alvin', 'Ceejay', 'Chloe', 'Cleopatra'],
    addAlternates: [],
  },
  {
    event: { namePattern: /grazettes/i },
    addPrimaries: ['Owen', 'Alvin', 'Cleopatra'],
    addAlternates: [],
    removePrimaries: ['Ceejay', 'Michaela'], // wrong assignments from calendar sync
  },
  {
    event: { namePattern: /mist.*steam/i },
    addPrimaries: ['Nathan', 'Ormalleo', 'Ceejay', 'Cheryse', 'Alvin', 'Owen'],
    addAlternates: [],
  },
  {
    event: { code: 'EXT-VBS' }, // VBS
    addPrimaries: [],
    addAlternates: ['Alvin'],
  },
  // Island Roots Learning Camp — new event
  {
    event: { namePattern: /island roots/i },
    addPrimaries: ['Ceejay', 'Cheryse', 'Alvin', 'Ormalleo'],
    addAlternates: [],
    createIfMissing: {
      name: 'Island Roots Learning (Summer) Camp',
      code: 'EVT-007',
      host: 'Island Roots Learning',
      hostColor: 'slate',
      location: 'Blackman & Gollop School',
      startDate: '2026-06-15',
      endDate: '2026-08-28',
      startTime: '09:00',
      endTime: '15:00',
    },
  },
]

// ── Apply fixes ─────────────────────────────────────────────────────────

console.log('=== APPLYING FIXES ===\n')

for (const fix of fixes) {
  let eventId = await getEventId(fix.event)

  // Create if missing
  if (!eventId && fix.createIfMissing) {
    const c = fix.createIfMissing
    eventId = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO Event (id, code, name, host, hostColor, location, description, startDate, endDate,
            startTime, endTime, status, ageRange, participantCount, requiredInstructors,
            notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'Confirmed', '4-15', NULL, 4, NULL, datetime('now'), datetime('now'))`,
      args: [
        eventId, c.code, c.name, c.host, c.hostColor, c.location,
        new Date(c.startDate + 'T00:00:00.000Z').toISOString(),
        new Date(c.endDate + 'T23:59:59.000Z').toISOString(),
        c.startTime, c.endTime,
      ],
    })
    console.log(`  ✓ Created new event: ${c.name} (${c.code})`)
  }

  if (!eventId) {
    console.log(`  ⚠ Event not found: ${JSON.stringify(fix.event)} — skipping`)
    continue
  }

  const dateStr = await getEventStartDate(eventId)
  const eventName = (await db.execute({ sql: 'SELECT name FROM Event WHERE id = ?', args: [eventId] })).rows[0].name

  // Remove wrong assignments
  if (fix.removePrimaries) {
    for (const name of fix.removePrimaries) {
      const pid = findProfileId(name)
      if (pid) {
        await removeAssignment(eventId, pid)
        console.log(`  ✗ Removed ${name} from ${eventName}`)
      }
    }
  }

  // Add missing primaries
  for (const name of fix.addPrimaries) {
    const pid = findProfileId(name)
    if (!pid) {
      console.log(`  ⚠ "${name}" not found in profiles — skipping`)
      continue
    }
    await addAssignment(eventId, pid, dateStr, false)
    console.log(`  ✓ Added ${name} (primary) to ${eventName}`)
  }

  // Add missing alternates
  for (const name of fix.addAlternates) {
    const pid = findProfileId(name)
    if (!pid) {
      console.log(`  ⚠ "${name}" not found in profiles — skipping`)
      continue
    }
    await addAssignment(eventId, pid, dateStr, true)
    console.log(`  ✓ Added ${name} (alternate) to ${eventName}`)
  }
}

// ── Summary ─────────────────────────────────────────────────────────────

const totalAssignments = await db.execute({ sql: 'SELECT COUNT(*) as n FROM Assignment' })
console.log(`\n=== COMPLETE ===`)
console.log(`  Total assignments in DB: ${totalAssignments.rows[0].n}`)

db.close()
