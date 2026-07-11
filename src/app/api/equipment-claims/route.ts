import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/equipment-claims?equipmentItemId=<id> — list claims for an equipment item
// POST /api/equipment-claims — create or update a claim (instructor says "I'll bring this")
//   Body: { equipmentItemId, quantityClaimed, transportOffered, notes }
// DELETE /api/equipment-claims?id=<claimId> — release a claim

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const equipmentItemId = searchParams.get('equipmentItemId')

  try {
    if (equipmentItemId) {
      const result = await db.execute({
        sql: `SELECT c.*, p.name as profileName FROM EquipmentClaim c
              LEFT JOIN Profile p ON c.profileId = p.id
              WHERE c.equipmentItemId = ? ORDER BY c.createdAt ASC`,
        args: [equipmentItemId],
      })
      return NextResponse.json(result.rows.map((c: any) => ({
        id: c.id,
        equipmentItemId: c.equipmentItemId,
        profileId: c.profileId,
        profileName: c.profileName ?? 'Unknown',
        quantityClaimed: c.quantityClaimed,
        transportOffered: !!c.transportOffered,
        notes: c.notes,
        createdAt: c.createdAt,
      })))
    }
    return NextResponse.json([])
  } catch (e: any) {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!user.profileId) return NextResponse.json({ error: 'No staff profile linked' }, { status: 400 })

  const body = await req.json()
  const { equipmentItemId, quantityClaimed, transportOffered, notes } = body as {
    equipmentItemId: string; quantityClaimed: number; transportOffered?: boolean; notes?: string
  }

  if (!equipmentItemId || typeof quantityClaimed !== 'number' || quantityClaimed < 1) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Check for existing claim by this user on this equipment item
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM EquipmentClaim WHERE equipmentItemId = ? AND profileId = ?',
      args: [equipmentItemId, user.profileId],
    })

    if (existing.rows.length > 0) {
      // Update existing claim
      const claimId = (existing.rows[0] as any).id
      await db.execute({
        sql: `UPDATE EquipmentClaim SET quantityClaimed = ?, transportOffered = ?, notes = ?, updatedAt = datetime('now') WHERE id = ?`,
        args: [quantityClaimed, transportOffered ? 1 : 0, notes ?? null, claimId],
      })
      return NextResponse.json({ id: claimId, updated: true })
    }

    // Create new claim
    const id = crypto.randomUUID()
    try {
      await db.execute({
        sql: `INSERT INTO EquipmentClaim (id, equipmentItemId, profileId, quantityClaimed, transportOffered, notes, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [id, equipmentItemId, user.profileId, quantityClaimed, transportOffered ? 1 : 0, notes ?? null],
      })
    } catch (e: any) {
      // Table doesn't exist — create it
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
      await db.execute({
        sql: `INSERT INTO EquipmentClaim (id, equipmentItemId, profileId, quantityClaimed, transportOffered, notes, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [id, equipmentItemId, user.profileId, quantityClaimed, transportOffered ? 1 : 0, notes ?? null],
      })
    }

    return NextResponse.json({ id, created: true }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to claim' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    // Instructors can only release their own claims; admins can release any
    if (user.role === 'admin') {
      await db.execute({ sql: 'DELETE FROM EquipmentClaim WHERE id = ?', args: [id] })
    } else {
      await db.execute({
        sql: 'DELETE FROM EquipmentClaim WHERE id = ? AND profileId = ?',
        args: [id, user.profileId],
      })
    }
  } catch (e: any) {
    // Table might not exist
  }

  return NextResponse.json({ ok: true })
}
