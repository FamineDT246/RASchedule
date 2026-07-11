import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, requireAdmin } from '@/lib/auth-helpers'

// GET /api/event-equipment?eventId=<id> — list equipment items + claims for an event
// POST /api/event-equipment — add an equipment item to an event (admin only)
// DELETE /api/event-equipment?id=<itemId> — remove an equipment item (admin only, cascades to claims)
// PATCH /api/event-equipment?id=<itemId> — update quantity/notes (admin only)

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  try {
    const items = await db.execute({
      sql: `SELECT * FROM EventEquipment WHERE eventId = ? ORDER BY createdAt ASC`,
      args: [eventId],
    })

    const result = []
    for (const item of items.rows as any[]) {
      const claims = await db.execute({
        sql: `SELECT c.*, p.name as profileName FROM EquipmentClaim c
              LEFT JOIN Profile p ON c.profileId = p.id
              WHERE c.equipmentItemId = ? ORDER BY c.createdAt ASC`,
        args: [item.id],
      })
      result.push({
        id: item.id,
        eventId: item.eventId,
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        claims: claims.rows.map((c: any) => ({
          id: c.id,
          equipmentItemId: c.equipmentItemId,
          profileId: c.profileId,
          profileName: c.profileName ?? 'Unknown',
          quantityClaimed: c.quantityClaimed,
          transportOffered: !!c.transportOffered,
          notes: c.notes,
          createdAt: c.createdAt,
        })),
      })
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req); if (auth) return auth
  const body = await req.json()
  const { eventId, name, quantity, notes } = body as {
    eventId: string; name: string; quantity?: number; notes?: string
  }

  if (!eventId || !name || !name.trim()) {
    return NextResponse.json({ error: 'eventId and name are required' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  try {
    await db.execute({
      sql: `INSERT INTO EventEquipment (id, eventId, name, quantity, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [id, eventId, name.trim(), quantity ?? 1, notes ?? null],
    })
  } catch (e: any) {
    try {
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
      await db.execute({
        sql: `INSERT INTO EventEquipment (id, eventId, name, quantity, notes, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [id, eventId, name.trim(), quantity ?? 1, notes ?? null],
      })
    } catch (e2: any) {
      return NextResponse.json({ error: 'Failed to add equipment' }, { status: 500 })
    }
  }

  return NextResponse.json({ id, eventId, name: name.trim(), quantity: quantity ?? 1, notes: notes ?? null, claims: [] }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req); if (auth) return auth
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await req.json()
  const updates: string[] = []
  const args: unknown[] = []

  if (typeof body.quantity === 'number') { updates.push('quantity = ?'); args.push(body.quantity) }
  if ('notes' in body) { updates.push('notes = ?'); args.push(body.notes ?? null) }
  if (typeof body.name === 'string') { updates.push('name = ?'); args.push(body.name) }

  if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  updates.push("updatedAt = datetime('now')")
  args.push(id)

  try {
    await db.execute({ sql: `UPDATE EventEquipment SET ${updates.join(', ')} WHERE id = ?`, args })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req); if (auth) return auth
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await db.execute({ sql: 'DELETE FROM EquipmentClaim WHERE equipmentItemId = ?', args: [id] })
  } catch (e: any) {}
  try {
    await db.execute({ sql: 'DELETE FROM EventEquipment WHERE id = ?', args: [id] })
  } catch (e: any) {}

  return NextResponse.json({ ok: true })
}
