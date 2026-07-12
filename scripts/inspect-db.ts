/**
 * Inspect current database state — events, profiles, and assignments.
 */
import { createClient } from '@libsql/client'

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

console.log('=== PROFILES ===')
const profiles = await db.execute({ sql: 'SELECT id, name, roleTier FROM Profile ORDER BY name' })
for (const p of profiles.rows) {
  console.log(`  ${p.name} (${p.roleTier}) — ${p.id}`)
}

console.log('\n=== EVENTS ===')
const events = await db.execute({ sql: 'SELECT id, code, name, status, startDate, endDate FROM Event ORDER BY startDate' })
for (const e of events.rows) {
  console.log(`  [${e.code ?? '---'}] ${e.name} (${e.status}) ${String(e.startDate).slice(0,10)} → ${String(e.endDate).slice(0,10)}`)
}

console.log('\n=== ASSIGNMENT COUNT ===')
const count = await db.execute({ sql: 'SELECT COUNT(*) as n FROM Assignment' })
console.log(`  Total: ${count.rows[0].n}`)

db.close()
