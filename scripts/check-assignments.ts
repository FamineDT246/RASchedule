/**
 * Check instructor assignments from the Summer Schedule CSV against the DB.
 * Reports gaps and fixes them.
 *
 * Only checks WHO is assigned to WHAT event — ignores dates, times, etc.
 */

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const CSV = readFileSync("upload/Summer 2026 Availability, Schedule - '26 Summer Schedule.csv", 'utf-8')
const lines = CSV.split('\n').filter(l => l.trim())

// ── Parse the CSV: extract event number → instructors ──────────────────
// Column 14 (0-indexed) is "INSTRUCTORS ASSIGNED"
// We parse by splitting on commas but respecting quoted fields

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { fields.push(current); current = '' }
      else { current += ch }
    }
  }
  fields.push(current)
  return fields
}

// Map: event number → { name, primaries: string[], alternates: string[] }
type CSVEvent = { num: string; name: string; primaries: string[]; alternates: string[] }

const csvEvents: CSVEvent[] = []

// Known instructor first names
const KNOWN = ['Nathan','Ormalleo','Cheryse','Alvin','Annison','Darrel','Ceejay','Krea',
  'Taria','Owen','Chloe','Michaela','Cleopatra','Zavier','Rhianne','Rashawn',
  'Terje','Terrence','deVere','Jelani']

function extractInstructors(text: string): { primaries: string[]; alternates: string[] } {
  const primaries: string[] = []
  const alternates: string[] = []
  const lower = text.toLowerCase()

  // Split by role labels
  const parts = text.split(/(?:Senior Instructors?|Junior Instructors?|Interns?|Instructors?|Alternates?):\s*/i)
  // The first part is empty or junk, the rest are role-grouped names

  let isAlternate = false
  for (let i = 1; i < parts.length; i++) {
    // Check if the preceding label was "Alternate"
    const beforePart = text.toLowerCase().indexOf(parts[i-1].toLowerCase()) + parts[i-1].length
    // Simpler: just check if "alternate" appears before this part
    const labelStart = text.toLowerCase().lastIndexOf('alternate', text.indexOf(parts[i]))
    const seniorStart = text.toLowerCase().lastIndexOf('senior', text.indexOf(parts[i]))
    const juniorStart = text.toLowerCase().lastIndexOf('junior', text.indexOf(parts[i]))
    const internStart = text.toLowerCase().lastIndexOf('intern', text.indexOf(parts[i]))

    const maxLabel = Math.max(labelStart, seniorStart, juniorStart, internStart)
    const isAlt = maxLabel === labelStart && labelStart >= 0

    // Extract names from this part — split by comma, filter to known names
    const names = parts[i].split(/[,\n]/).map(n => n.trim()).filter(n => {
      return KNOWN.some(k => n.toLowerCase() === k.toLowerCase())
    })

    if (isAlt) {
      alternates.push(...names)
    } else {
      primaries.push(...names)
    }
  }

  // If no role labels were found, just extract all known names
  if (primaries.length === 0 && alternates.length === 0) {
    const allNames = text.split(/[,\n]/).map(n => n.trim()).filter(n => {
      return KNOWN.some(k => n.toLowerCase() === k.toLowerCase())
    })
    primaries.push(...allNames)
  }

  return { primaries: [...new Set(primaries)], alternates: [...new Set(alternates)] }
}

for (const line of lines) {
  const fields = parseCSVLine(line)
  const num = fields[0]?.trim()
  if (!num || !/^\d+$/.test(num)) continue

  const name = fields[1]?.trim() || ''
  const instructorText = fields[14]?.trim() || ''
  if (!instructorText) continue

  const { primaries, alternates } = extractInstructors(instructorText)
  csvEvents.push({ num, name, primaries, alternates })
}

console.log('=== CSV INSTRUCTOR ASSIGNMENTS ===\n')
for (const ev of csvEvents) {
  console.log(`  #${ev.num} ${ev.name}`)
  console.log(`    Primaries: ${ev.primaries.join(', ') || '(none)'}`)
  console.log(`    Alternates: ${ev.alternates.join(', ') || '(none)'}`)
  console.log()
}

// ── Load current DB state ───────────────────────────────────────────────

const profileResult = await db.execute({ sql: 'SELECT id, name FROM Profile' })
const profiles = profileResult.rows.map((p: any) => ({
  id: p.id,
  name: p.name,
  firstName: (p.name as string).split(' ')[0].toLowerCase(),
}))

function findProfile(firstName: string): string | null {
  const lower = firstName.toLowerCase().trim()
  const exact = profiles.find(p => p.firstName === lower)
  if (exact) return exact.id
  const fuzzy = profiles.find(p => p.firstName.startsWith(lower.slice(0, 3)))
  if (fuzzy) return fuzzy.id
  return null
}

const eventResult = await db.execute({ sql: 'SELECT id, code, name FROM Event' })
const dbEvents = eventResult.rows as any[]

// Map CSV event numbers to DB event IDs
// Using known code mappings
const EVENT_MAP: Record<string, string | null> = {}
for (const ev of csvEvents) {
  const name = ev.name.toLowerCase()
  let dbEvent: any = null

  if (ev.num === '1') dbEvent = dbEvents.find(e => e.code === 'WSB-1')
  else if (ev.num === '2') dbEvent = dbEvents.find(e => e.code === 'WSB-2')
  else if (ev.num === '3') dbEvent = dbEvents.find(e => e.code === 'MEdT-3' || /exhibition/i.test(e.name))
  else if (ev.num === '4') dbEvent = dbEvents.find(e => e.code === 'MEdT-4' || /true blue/i.test(e.name))
  else if (ev.num === '5') dbEvent = dbEvents.find(e => e.code === 'MYSCE-5')
  else if (ev.num === '6') dbEvent = dbEvents.find(e => e.code === 'MYSCE-6')
  else if (ev.num === '7') dbEvent = dbEvents.find(e => e.code === 'MYSCE-7')
  else if (ev.num === '8') dbEvent = dbEvents.find(e => e.code === 'MYSCE-8')
  else if (ev.num === '9') dbEvent = dbEvents.find(e => e.code === 'MYSCE-9')
  else if (ev.num === '10') dbEvent = dbEvents.find(e => e.code === 'LPK-10' || /liliplum.*workshop 1/i.test(e.name) || /liliplum.*chameleon/i.test(e.name))
  else if (ev.num === '11') dbEvent = dbEvents.find(e => e.code === 'LPK-11' || /liliplum.*workshop 2/i.test(e.name) || /liliplum.*hydrant/i.test(e.name))
  else if (ev.num === '12') dbEvent = dbEvents.find(e => /st\.?\s*giles/i.test(e.name))
  else if (ev.num === '13') dbEvent = dbEvents.find(e => e.code === 'DYC-13' || /national summer camp/i.test(e.name))
  else if (ev.num === '14') dbEvent = dbEvents.find(e => e.code === 'DYC-14' || /national youth day/i.test(e.name))
  else if (ev.num === '15') dbEvent = dbEvents.find(e => e.code === 'MYSCE-15' || /grazettes/i.test(e.name))
  else if (ev.num === '16') dbEvent = dbEvents.find(e => /mist.*steam/i.test(e.name))
  else if (ev.num === '17') dbEvent = dbEvents.find(e => /island roots/i.test(e.name)) // new event
  else if (ev.num === '18') dbEvent = dbEvents.find(e => e.code === 'EXT-VBS' || /vacation bible|vbs/i.test(e.name))
  else if (ev.num === '19') dbEvent = dbEvents.find(e => /curious kid/i.test(e.name))

  EVENT_MAP[ev.num] = dbEvent?.id ?? null
}

// ── Compare and report gaps ─────────────────────────────────────────────

console.log('\n=== GAP ANALYSIS ===\n')

for (const ev of csvEvents) {
  const eventId = EVENT_MAP[ev.num]
  if (!eventId) {
    console.log(`  ⚠ #${ev.num} ${ev.name} — NOT IN DB (new event needed)`)
    continue
  }

  // Get current assignments from DB
  const assignments = await db.execute({
    sql: `SELECT a.profileId, a.isAlternative, p.name as profileName
          FROM Assignment a JOIN Profile p ON a.profileId = p.id
          WHERE a.eventId = ?`,
    args: [eventId],
  })

  const dbPrimaries = new Set<string>()
  const dbAlternates = new Set<string>()
  for (const a of assignments.rows as any[]) {
    const firstName = a.profileName.split(' ')[0]
    if (a.isAlternative) dbAlternates.add(firstName)
    else dbPrimaries.add(firstName)
  }

  const csvPrimaries = new Set(ev.primaries)
  const csvAlternates = new Set(ev.alternates)

  const missingPrimaries = [...csvPrimaries].filter(p => !dbPrimaries.has(p))
  const missingAlternates = [...csvAlternates].filter(p => !dbAlternates.has(p))
  const extraPrimaries = [...dbPrimaries].filter(p => !csvPrimaries.has(p) && !csvAlternates.has(p))
  const extraAlternates = [...dbAlternates].filter(p => !csvAlternates.has(p) && !csvPrimaries.has(p))

  if (missingPrimaries.length === 0 && missingAlternates.length === 0 && extraPrimaries.length === 0 && extraAlternates.length === 0) {
    console.log(`  ✓ #${ev.num} ${ev.name} — matches`)
    continue
  }

  console.log(`  ✗ #${ev.num} ${ev.name}`)
  if (missingPrimaries.length > 0) console.log(`    MISSING primaries: ${missingPrimaries.join(', ')}`)
  if (missingAlternates.length > 0) console.log(`    MISSING alternates: ${missingAlternates.join(', ')}`)
  if (extraPrimaries.length > 0) console.log(`    EXTRA primaries (not in CSV): ${extraPrimaries.join(', ')}`)
  if (extraAlternates.length > 0) console.log(`    EXTRA alternates: ${extraAlternates.join(', ')}`)
  console.log()
}

db.close()
