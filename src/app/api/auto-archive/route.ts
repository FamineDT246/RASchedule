import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/auto-archive — two cleanup operations:
// 1. Archive events whose end date has passed
// 2. Remove unavailable dates older than 1 month from instructor profiles
//
// Safe to call repeatedly (idempotent).
// Called when the admin schedule is loaded.
export async function POST() {
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Barbados',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())

    // 1. Archive past events
    const result = await db.execute({
      sql: `SELECT id, name, endDate FROM Event
            WHERE status NOT IN ('Draft', 'Archived')
            AND endDate < ?`,
      args: [today + 'T23:59:59.000Z'],
    })

    let archived = 0
    for (const row of result.rows) {
      await db.execute({
        sql: "UPDATE Event SET status = 'Archived', updatedAt = datetime('now') WHERE id = ?",
        args: [(row as any).id],
      })
      archived++
    }

    // 2. Clean up old unavailable dates (older than 1 month)
    // Calculate the cutoff date (today - 30 days)
    const cutoffDate = new Date(today + 'T00:00:00.000Z')
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30)
    const cutoff = cutoffDate.toISOString().slice(0, 10)

    let cleanedProfiles = 0
    const profiles = await db.execute({
      sql: "SELECT id, unavailable FROM Profile WHERE unavailable IS NOT NULL AND unavailable != ''",
    })

    for (const p of profiles.rows as any[]) {
      const dates = String(p.unavailable).split(',').map(s => s.trim()).filter(Boolean)
      const kept = dates.filter(d => d >= cutoff)
      if (kept.length !== dates.length) {
        await db.execute({
          sql: "UPDATE Profile SET unavailable = ?, updatedAt = datetime('now') WHERE id = ?",
          args: [kept.length > 0 ? kept.join(',') : null, p.id],
        })
        cleanedProfiles++
      }
    }

    return NextResponse.json({ archived, cleanedProfiles })
  } catch (e: any) {
    console.error('Auto-archive error:', e.message)
    return NextResponse.json({ archived: 0, cleanedProfiles: 0, error: e.message })
  }
}
