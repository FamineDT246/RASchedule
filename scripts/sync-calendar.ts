/**
 * Sync the summer 2026 calendar CSV to the Turso database.
 * v2 — fixed parsing issues from v1.
 *
 * Issues fixed:
 * - Virtual Meetings were matching WSB-1 — now they're separate events
 * - National Summer Camp Programme camps are ONE event with specific dates (not 15 separate events)
 * - "Robotics Workshop", "DAY N", "Oceana", "Locations: TBD" no longer parsed as instructors
 * - Better event name extraction
 */

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const CSV_PATH = "upload/Summer 2026 Availability, Schedule - '26 Calendar.csv"
const raw = readFileSync(CSV_PATH, 'utf-8')

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { currentField += '"'; i++ }
        else { inQuotes = false }
      } else { currentField += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { currentRow.push(currentField); currentField = '' }
      else if (ch === '\n') { currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = '' }
      else if (ch === '\r') { /* skip */ }
      else { currentField += ch }
    }
  }
  if (currentField || currentRow.length) { currentRow.push(currentField); rows.push(currentRow) }
  return rows.filter(r => r.some(c => c.trim()))
}

const rows = parseCSV(raw)

type ParsedEvent = {
  date: string
  name: string          // canonical event name (grouped)
  rawName: string       // full name from CSV
  location: string | null
  startTime: string
  endTime: string
  status: string
  instructors: string[]
  shirtColor: string | null
  raw: string
}

let currentDates: string[] = []

function parseDateHeader(s: string): string | null {
  const m = s.match(/(\w+),?\s+(\w+)\s+(\d+),?\s+(\d{4})/)
  if (!m) return null
  const [, , monthName, day, year] = m
  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
    July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
  }
  const mm = months[monthName]
  if (!mm) return null
  return `${year}-${mm}-${String(day).padStart(2, '0')}`
}

function parseTime(t: string): string {
  const m = t.match(/(\d+)(?::(\d+))?\s*(am|pm)/i)
  if (!m) return '09:00'
  let h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// Known instructor first names (for filtering out non-instructor text)
const KNOWN_INSTRUCTORS = [
  'Nathan', 'Ormalleo', 'Cheryse', 'Alvin', 'Annison', 'Darrel', 'Ceejay', 'Krea',
  'Taria', 'Owen', 'Chloe', 'Michaela', 'Cleopatra', 'Zavier', 'Rhianne', 'Rashawn',
  'Terje', 'Terrence', 'deVere', 'Jelani',
]

// Canonical event name mapping — groups CSV variants to one event
function canonicalName(rawName: string): string {
  const n = rawName.trim()
  // National Summer Camp Programme — all camps are ONE event
  if (/national summer camp/i.test(n)) return 'National Summer Camp Programme'
  // Virtual meetings — two separate events
  if (/post mortem/i.test(n)) return 'Virtual Meeting — Post Mortem (Aerial Robotics)'
  if (/preparation for summer week 2/i.test(n)) return 'Virtual Meeting — Preparation for Summer Week 2'
  // Grazettes — all days are ONE event
  if (/grazettes/i.test(n)) return 'Grazettes Community Center — Robotics Workshop'
  // MIST STEAM Camp
  if (/mist.*steam/i.test(n)) return 'MIST STEAM Camp — Robotics Workshops'
  // WSB
  if (/aerial robotics/i.test(n)) return 'WSB — Aerial Robotics'
  if (/3d.*print/i.test(n)) return 'WSB — 3D Digital Printing'
  // True Blue Summer
  if (/true blue/i.test(n)) return 'True Blue Summer'
  // St. Giles Primary
  if (/st\.?\s*giles/i.test(n)) return 'St. Giles Primary — Oceana'
  // Liliplum Kids (workshops + preparation)
  if (/preparation.*liliplum/i.test(n)) return 'Preparation for Liliplum Kids — Robotics Workshop'
  if (/liliplum/i.test(n)) return 'Liliplum Kids — Robotics Workshop'
  // VBS
  if (/vacation bible|vbs/i.test(n)) return 'Vacation Bible School — Robotics Workshop'
  // Exhibition
  if (/exhibition/i.test(n)) return 'Exhibition — Oceana Innovation Hub'
  // National Youth Day
  if (/national youth day/i.test(n)) return 'National Youth Day — Robotics & Renewable Energy Showcase'
  // Curious Kids
  if (/curious kids/i.test(n)) return 'Curious Kids — Robotics Workshop'
  return n
}

function parseCell(cell: string, date: string): ParsedEvent | null {
  const text = cell.trim()
  if (!text || text === 'KADOOMENT             (NO CAMP)') return null

  let status = 'Confirmed'
  let working = text

  if (/^COMPLETED/i.test(working)) {
    status = 'Archived'
    working = working.replace(/^COMPLETED,?\s*/i, '')
  } else if (/^NOT CONFIRMED/i.test(working) || /^\(NOT CONFIRMED\)/i.test(working)) {
    status = 'Tentative'
    working = working.replace(/^\(?\s*NOT CONFIRMED\s*\)?,?\s*/i, '')
  }

  // Extract location (handle "Location:" and "Locations:" typos)
  let location: string | null = null
  const locMatch = working.match(/Locations?:\s*([^,]+?)(?:,\s*|$)/i)
  if (locMatch) {
    location = locMatch[1].trim()
    working = working.replace(locMatch[0], '')
  }

  // Extract shirt color
  let shirtColor: string | null = null
  const shirtMatch = working.match(/Shirt:\s*(\w+)/i)
  if (shirtMatch) {
    shirtColor = shirtMatch[1].trim()
    working = working.replace(shirtMatch[0], '')
  }

  // Extract time range
  let startTime = '09:00'
  let endTime = '15:00'
  const timeMatch = working.match(/(\d+(?::\d+)?\s*[ap]m)\s*[-–]\s*(\d+(?::\d+)?\s*[ap]m)/i)
  if (timeMatch) {
    startTime = parseTime(timeMatch[1])
    endTime = parseTime(timeMatch[2])
    working = working.replace(timeMatch[0], '')
  }

  // Split remaining text by commas
  const parts = working.split(',').map(p => p.trim()).filter(Boolean)
  const rawName = parts[0] || 'Unknown Event'
  const canonName = canonicalName(rawName)

  // Instructors: filter to only known first names
  const instructors = parts.slice(1).filter(p => {
    const lower = p.toLowerCase().trim()
    // Must be a known instructor first name
    return KNOWN_INSTRUCTORS.some(name => lower === name.toLowerCase())
  })

  return {
    date,
    name: canonName,
    rawName,
    location,
    startTime,
    endTime,
    status,
    instructors,
    shirtColor,
    raw: text,
  }
}

const events: ParsedEvent[] = []

for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
  const row = rows[rowIdx]
  const firstCell = row[0]?.trim() || ''
  const parsedDate = parseDateHeader(firstCell)

  if (parsedDate) {
    currentDates = row.map(c => parseDateHeader(c.trim()) || '').filter(Boolean)
    while (currentDates.length < 7) currentDates.push('')
    continue
  }

  if (/^(July|August|September|Week\s+\d+)/i.test(firstCell)) continue
  if (/^\w+\s+\d+\s+\d{4}$/.test(firstCell) && !firstCell.includes(',')) continue

  if (currentDates.length === 0) continue

  for (let col = 0; col < Math.min(row.length, currentDates.length); col++) {
    const cell = row[col]
    const date = currentDates[col]
    if (!date || !cell.trim()) continue
    const ev = parseCell(cell, date)
    if (ev) events.push(ev)
  }
}

console.log(`Parsed ${events.length} event-rows from the CSV\n`)

// Group by canonical name
const byName = new Map<string, ParsedEvent[]>()
for (const ev of events) {
  if (!byName.has(ev.name)) byName.set(ev.name, [])
  byName.get(ev.name)!.push(ev)
}

console.log('=== EVENTS BY CANONICAL NAME ===')
for (const [name, evs] of byName) {
  console.log(`  ${name} (${evs.length} dates) — ${evs[0].status}`)
  console.log(`    Location: ${evs[0].location}, Time: ${evs[0].startTime}-${evs[0].endTime}`)
  console.log(`    Dates: ${evs.map(e => e.date).join(', ')}`)
  const allInstructors = new Set<string>()
  for (const e of evs) e.instructors.forEach(i => allInstructors.add(i))
  if (allInstructors.size > 0) console.log(`    Instructors: ${Array.from(allInstructors).join(', ')}`)
  console.log()
}

// ── Load profiles ───────────────────────────────────────────────────────

const profileResult = await db.execute({ sql: 'SELECT id, name FROM Profile ORDER BY name' })
const profiles = profileResult.rows.map((p: any) => ({
  id: p.id as string,
  name: p.name as string,
  firstName: (p.name as string).split(' ')[0].toLowerCase(),
}))

function findProfile(firstName: string): { id: string; name: string } | null {
  const lower = firstName.toLowerCase().trim()
  const exact = profiles.find(p => p.firstName === lower)
  if (exact) return { id: exact.id, name: exact.name }
  const fuzzy = profiles.find(p => p.firstName.startsWith(lower.slice(0, 3)))
  if (fuzzy) return { id: fuzzy.id, name: fuzzy.name }
  return null
}

// ── Event matching config ───────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { code?: string; host: string; hostColor: string }> = {
  'WSB — Aerial Robotics': { code: 'WSB-1', host: 'TVETC / WSB', hostColor: 'teal' },
  'WSB — 3D Digital Printing': { code: 'WSB-2', host: 'TVETC / WSB', hostColor: 'teal' },
  'Liliplum Kids — Robotics Workshop': { code: 'LPK-10', host: 'Liliplum Kids', hostColor: 'pink' },
  'Vacation Bible School — Robotics Workshop': { code: 'EXT-VBS', host: 'External', hostColor: 'slate' },
  'True Blue Summer': { code: 'MEdT-4', host: 'MEdT', hostColor: 'emerald' },
  'National Summer Camp Programme': { code: 'DYC-13', host: 'Division of Youth & Culture', hostColor: 'rose' },
  'Grazettes Community Center — Robotics Workshop': { code: 'MYSCE-15', host: 'MYSCE', hostColor: 'amber' },
  'National Youth Day — Robotics & Renewable Energy Showcase': { code: 'DYC-14', host: 'Division of Youth & Culture', hostColor: 'rose' },
  'MIST STEAM Camp — Robotics Workshops': { host: 'MIST', hostColor: 'sky' },
  'St. Giles Primary — Oceana': { host: 'Division of Youth & Culture', hostColor: 'rose' },
  'Exhibition — Oceana Innovation Hub': { code: 'MEdT-3', host: 'MEdT', hostColor: 'emerald' },
  'Preparation for Liliplum Kids — Robotics Workshop': { host: 'Liliplum Kids', hostColor: 'pink' },
  'Virtual Meeting — Post Mortem (Aerial Robotics)': { host: 'Internal', hostColor: 'slate' },
  'Virtual Meeting — Preparation for Summer Week 2': { host: 'Internal', hostColor: 'slate' },
  'Curious Kids — Robotics Workshop': { host: 'External', hostColor: 'slate' },
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Sync each event ─────────────────────────────────────────────────────

console.log('=== SYNCING EVENTS ===\n')

for (const [name, evs] of byName) {
  const config = EVENT_CONFIG[name] ?? { host: 'External', hostColor: 'slate' }

  const dates = evs.map(e => e.date).sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]
  // Use specificDates if dates are non-consecutive
  const useSpecificDates = dates.length > 1 && dates.some((d, i) => i > 0 && d !== addDays(dates[i - 1], 1))

  const status = evs[0].status
  const location = evs[0].location
  const startTime = evs[0].startTime
  const endTime = evs[0].endTime
  const maxInstructors = Math.max(2, ...evs.map(e => e.instructors.length))

  // Find existing event by code ONLY (name matching is too error-prone)
  let existing: any = null
  if (config.code) {
    const r = await db.execute({ sql: 'SELECT * FROM Event WHERE code = ?', args: [config.code] })
    if (r.rows.length > 0) existing = r.rows[0]
  }

  // For events without a code, try exact name match only
  if (!existing && !config.code) {
    const r = await db.execute({ sql: 'SELECT * FROM Event WHERE name = ?', args: [name] })
    if (r.rows.length > 0) existing = r.rows[0]
  }

  let eventId: string
  let eventCode: string | null

  if (existing) {
    eventId = existing.id
    eventCode = existing.code
    await db.execute({
      sql: `UPDATE Event SET name = ?, host = ?, hostColor = ?, location = ?, startDate = ?, endDate = ?,
            startTime = ?, endTime = ?, status = ?, specificDates = ?, requiredInstructors = ?,
            updatedAt = datetime('now') WHERE id = ?`,
      args: [
        name, config.host, config.hostColor, location,
        new Date(startDate + 'T00:00:00.000Z').toISOString(),
        new Date(endDate + 'T23:59:59.000Z').toISOString(),
        startTime, endTime, status,
        useSpecificDates ? dates.join(',') : null,
        maxInstructors,
        eventId,
      ],
    })
    console.log(`  ✓ Updated: ${name} (${eventCode ?? 'no code'}) — ${dates.length} dates`)
  } else {
    eventId = crypto.randomUUID()
    eventCode = config.code ?? `EVT-${String(byName.size).padStart(3, '0')}`
    await db.execute({
      sql: `INSERT INTO Event (id, code, name, host, hostColor, location, description, startDate, endDate,
            startTime, endTime, status, specificDates, ageRange, participantCount, requiredInstructors,
            notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, datetime('now'), datetime('now'))`,
      args: [
        eventId, eventCode, name, config.host, config.hostColor, location,
        new Date(startDate + 'T00:00:00.000Z').toISOString(),
        new Date(endDate + 'T23:59:59.000Z').toISOString(),
        startTime, endTime, status,
        useSpecificDates ? dates.join(',') : null,
        maxInstructors,
      ],
    })
    console.log(`  ✓ Created: ${name} (${eventCode}) — ${dates.length} dates`)
  }

  // Delete existing assignments for this event
  await db.execute({ sql: 'DELETE FROM Assignment WHERE eventId = ?', args: [eventId] })

  // Create new assignments
  let assignmentCount = 0
  for (const ev of evs) {
    for (const instructorName of ev.instructors) {
      const profile = findProfile(instructorName)
      if (!profile) {
        console.log(`    ⚠ "${instructorName}" not found — skipping`)
        continue
      }
      await db.execute({
        sql: `INSERT INTO Assignment (id, eventId, profileId, assignedDate, status, isAlternative, shirtColor, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, 'Assigned', 0, ?, datetime('now'), datetime('now'))`,
        args: [
          crypto.randomUUID(),
          eventId,
          profile.id,
          new Date(ev.date + 'T00:00:00.000Z').toISOString(),
          ev.shirtColor,
        ],
      })
      assignmentCount++
    }
  }
  if (assignmentCount > 0) {
    console.log(`    → ${assignmentCount} assignments`)
  }
}

// ── Summary ─────────────────────────────────────────────────────────────

const finalCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM Assignment' })
const eventCount = await db.execute({ sql: 'SELECT COUNT(*) as n FROM Event' })
console.log(`\n=== SYNC COMPLETE ===`)
console.log(`  Events in DB: ${eventCount.rows[0].n}`)
console.log(`  Assignments in DB: ${finalCount.rows[0].n}`)

db.close()
