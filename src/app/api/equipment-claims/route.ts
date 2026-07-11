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

  // Server-side check: don't allow claiming more than what's needed minus already-claimed
  try {
    const itemResult = await db.execute({
      sql: 'SELECT quantity FROM EventEquipment WHERE id = ?',
      args: [equipmentItemId],
    })
    if (itemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Equipment item not found' }, { status: 404 })
    }
    const needed = (itemResult.rows[0] as any).quantity as number

    const allClaims = await db.execute({
      sql: 'SELECT profileId, quantityClaimed FROM EquipmentClaim WHERE equipmentItemId = ?',
      args: [equipmentItemId],
    })
    const claimedByOthers = (allClaims.rows as any[])
      .filter(c => c.profileId !== user.profileId)
      .reduce((sum, c) => sum + (c.quantityClaimed as number), 0)
    const available = needed - claimedByOthers

    if (quantityClaimed > available) {
      return NextResponse.json(
        { error: `Only ${available} available (you can't claim ${quantityClaimed})` },
        { status: 400 },
      )
    }
  } catch (e: any) {
    // Tables might not exist yet — proceed; the create-table fallback below handles it
  }

  // Check for existing claim by this user on this equipment item.
  // Wrapped in its own try/catch so a missing table is treated as "no existing claim"
  // rather than a 500 (the table is created on-demand below).
  let existingId: string | null = null
  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM EquipmentClaim WHERE equipmentItemId = ? AND profileId = ?',
      args: [equipmentItemId, user.profileId],
    })
    if (existing.rows.length > 0) {
      existingId = (existing.rows[0] as any).id
    }
  } catch {
    // Table doesn't exist yet — treat as no existing claim
  }

  if (existingId) {
    // Update existing claim
    try {
      await db.execute({
        sql: `UPDATE EquipmentClaim SET quantityClaimed = ?, transportOffered = ?, notes = ?, updatedAt = datetime('now') WHERE id = ?`,
        args: [quantityClaimed, transportOffered ? 1 : 0, notes ?? null, existingId],
      })
      return NextResponse.json({ id: existingId, updated: true })
    } catch (e: any) {
      return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 })
    }
  }

  // Create new claim (with on-demand table creation)
  const id = crypto.randomUUID()
  try {
    await db.execute({
      sql: `INSERT INTO EquipmentClaim (id, equipmentItemId, profileId, quantityClaimed, transportOffered, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [id, equipmentItemId, user.profileId, quantityClaimed, transportOffered ? 1 : 0, notes ?? null],
    })
  } catch (e: any) {
    // Table doesn't exist — create it then retry the insert
    try {
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
    } catch (e2: any) {
      return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 })
    }
  }

  return NextResponse.json({ id, created: true }, { status: 201 })
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
