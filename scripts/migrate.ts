/**
 * Migration script — adds new tables and columns to an existing database.
 *
 * Safe to run multiple times — uses IF NOT EXISTS / IF NOT EXISTS patterns.
 *
 * Run with:
 *   bun run scripts/migrate.ts
 *
 * Or set up a package.json script:
 *   "migrate": "bun run scripts/migrate.ts"
 */

import { createClient } from '@libsql/client'

const tursoUrl = process.env.TURSO_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

const db = tursoUrl
  ? createClient({ url: tursoUrl, authToken: tursoAuthToken })
  : createClient({ url: process.env.DATABASE_URL || 'file:./db/custom.db' })

async function migrate() {
  console.log('Running migrations...')

  // ── New columns on existing tables ──────────────────────────────────────

  // User.emailNotifications (defaults to 1 = on)
  try {
    await db.execute({ sql: 'ALTER TABLE User ADD COLUMN emailNotifications INTEGER NOT NULL DEFAULT 1' })
    console.log('  ✓ User.emailNotifications added')
  } catch (e: any) {
    if (String(e.message).includes('duplicate column')) {
      console.log('  · User.emailNotifications already exists')
    } else {
      console.error('  ✗ Failed to add User.emailNotifications:', e.message)
    }
  }

  // Assignment.ackStatus + acknowledgedAt
  try {
    await db.execute({ sql: 'ALTER TABLE Assignment ADD COLUMN ackStatus TEXT' })
    console.log('  ✓ Assignment.ackStatus added')
  } catch (e: any) {
    if (String(e.message).includes('duplicate column')) {
      console.log('  · Assignment.ackStatus already exists')
    } else {
      console.error('  ✗ Failed to add Assignment.ackStatus:', e.message)
    }
  }
  try {
    await db.execute({ sql: 'ALTER TABLE Assignment ADD COLUMN acknowledgedAt TEXT' })
    console.log('  ✓ Assignment.acknowledgedAt added')
  } catch (e: any) {
    if (String(e.message).includes('duplicate column')) {
      console.log('  · Assignment.acknowledgedAt already exists')
    } else {
      console.error('  ✗ Failed to add Assignment.acknowledgedAt:', e.message)
    }
  }

  // ── New tables ──────────────────────────────────────────────────────────

  // Skill catalog (reusable across events + profiles)
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS Skill (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    createdAt TEXT NOT NULL
  )` })
  console.log('  ✓ Skill table ready')

  // Equipment catalog (reusable equipment items)
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS EquipmentCatalog (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    createdAt TEXT NOT NULL
  )` })
  console.log('  ✓ EquipmentCatalog table ready')

  // Per-event equipment (what's needed for a specific event)
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS EventEquipment (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE CASCADE
  )` })
  console.log('  ✓ EventEquipment table ready')

  // Equipment claims (instructor says "I'll bring this")
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS EquipmentClaim (
    id TEXT PRIMARY KEY,
    equipmentItemId TEXT NOT NULL,
    profileId TEXT NOT NULL,
    quantityClaimed INTEGER NOT NULL DEFAULT 1,
    transportOffered INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (equipmentItemId) REFERENCES EventEquipment(id) ON DELETE CASCADE
  )` })
  console.log('  ✓ EquipmentClaim table ready')

  // Unique index: one claim per instructor per equipment item (prevents TOCTOU race)
  try {
    await db.execute({ sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_equipmentclaim_item_profile ON EquipmentClaim (equipmentItemId, profileId)' })
    console.log('  ✓ EquipmentClaim unique index ready')
  } catch (e: any) {
    console.log('  · EquipmentClaim unique index already exists or failed:', e.message)
  }

  // Notifications (in-app bell)
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS Notification (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    eventId TEXT,
    assignmentId TEXT,
    readAt TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  )` })
  console.log('  ✓ Notification table ready')

  // Email queue (digest system)
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS EmailQueue (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    eventId TEXT,
    urgency TEXT NOT NULL DEFAULT 'digest',
    sentAt TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  )` })
  console.log('  ✓ EmailQueue table ready')

  // ── Seed skill catalog from existing data ──────────────────────────────

  console.log('\nSeeding skill catalog from existing skills...')
  const profiles = await db.execute({ sql: "SELECT skills FROM Profile WHERE skills IS NOT NULL AND skills != ''" })
  const events = await db.execute({ sql: 'SELECT skillName FROM EventSkill' })
  const skillSet = new Set<string>()
  for (const p of profiles.rows as any[]) {
    String(p.skills).split(',').map(s => s.trim()).filter(Boolean).forEach(s => skillSet.add(s))
  }
  for (const e of events.rows as any[]) {
    if (e.skillName) skillSet.add(e.skillName)
  }
  let seeded = 0
  for (const name of Array.from(skillSet).sort()) {
    try {
      await db.execute({
        sql: "INSERT INTO Skill (id, name, createdAt) VALUES (?, ?, datetime('now'))",
        args: [crypto.randomUUID(), name],
      })
      seeded++
    } catch (e: any) {
      // Already exists — skip
    }
  }
  console.log(`  ✓ Seeded ${seeded} skills into catalog`)

  console.log('\n✓ Migration complete.')
}

migrate()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.close())
