import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/equipment — list all equipment catalog items (any authenticated user)
// POST /api/equipment — create a new equipment catalog item (admin only)
// DELETE /api/equipment?id=<id> — remove from catalog (admin only)

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM EquipmentCatalog ORDER BY name ASC',
    })
    return NextResponse.json(result.rows.map((e: any) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      createdAt: e.createdAt,
    })))
  } catch (e: any) {
    // Table doesn't exist yet — return empty
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()
  const { name, description } = body as { name: string; description?: string }
  if (!name || !name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const id = crypto.randomUUID()
  try {
    await db.execute({
      sql: "INSERT INTO EquipmentCatalog (id, name, description, createdAt) VALUES (?, ?, ?, datetime('now'))",
      args: [id, name.trim(), description ?? null],
    })
  } catch (e: any) {
    if (String(e.message).includes('UNIQUE')) {
      return NextResponse.json({ error: 'Equipment already exists' }, { status: 409 })
    }
    // Table doesn't exist — create it then retry
    try {
      await db.execute({ sql: 'CREATE TABLE IF NOT EXISTS EquipmentCatalog (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, createdAt TEXT NOT NULL)' })
      await db.execute({
        sql: "INSERT INTO EquipmentCatalog (id, name, description, createdAt) VALUES (?, ?, ?, datetime('now'))",
        args: [id, name.trim(), description ?? null],
      })
    } catch (e2: any) {
      if (String(e2.message).includes('UNIQUE')) {
        return NextResponse.json({ error: 'Equipment already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create equipment' }, { status: 500 })
    }
  }

  return NextResponse.json({ id, name: name.trim(), description: description ?? null }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await db.execute({ sql: 'DELETE FROM EquipmentCatalog WHERE id = ?', args: [id] })
  } catch (e: any) {
    // Table doesn't exist — nothing to delete
  }

  return NextResponse.json({ ok: true })
}
