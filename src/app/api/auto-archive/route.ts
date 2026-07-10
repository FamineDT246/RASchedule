import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/auto-archive — automatically archive events whose end date has passed
// Called when the schedule is loaded. Safe to call repeatedly.
export async function POST() {
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Barbados',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())

    const result = await db.execute({
      sql: `SELECT id, name, endDate FROM Event 
            WHERE status NOT IN ('Draft', 'Archived') 
            AND endDate < ?`,
      args: [today + 'T23:59:59.000Z'],
    })

    if (result.rows.length === 0) {
      return NextResponse.json({ archived: 0 })
    }

    for (const row of result.rows) {
      await db.execute({
        sql: "UPDATE Event SET status = 'Archived', updatedAt = datetime('now') WHERE id = ?",
        args: [(row as any).id],
      })
    }

    return NextResponse.json({ archived: result.rows.length })
  } catch (e: any) {
    console.error('Auto-archive error:', e.message)
    return NextResponse.json({ archived: 0, error: e.message })
  }
}
