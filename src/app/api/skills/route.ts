import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/skills — list all skills in the catalog (any authenticated user)
// POST /api/skills — create a new skill in the catalog (admin only)
// DELETE /api/skills?id=<id> — remove a skill from the catalog (admin only)

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM Skill ORDER BY name ASC',
    })
    return NextResponse.json(result.rows.map((s: any) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
    })))
  } catch (e: any) {
    // Table doesn't exist yet — derive from existing skills in use
    const profiles = await db.execute({ sql: "SELECT skills FROM Profile WHERE skills IS NOT NULL AND skills != ''" })
    const events = await db.execute({ sql: 'SELECT skillName FROM EventSkill' })
    const skillSet = new Set<string>()
    for (const p of profiles.rows as any[]) {
      String(p.skills).split(',').map(s => s.trim()).filter(Boolean).forEach(s => skillSet.add(s))
    }
    for (const e of events.rows as any[]) {
      if (e.skillName) skillSet.add(e.skillName)
    }
    return NextResponse.json(Array.from(skillSet).sort().map((name, i) => ({
      id: `legacy-${i}`,
      name,
      createdAt: null,
    })))
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()
  const { name } = body as { name: string }
  if (!name || !name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const id = crypto.randomUUID()
  try {
    await db.execute({
      sql: "INSERT INTO Skill (id, name, createdAt) VALUES (?, ?, datetime('now'))",
      args: [id, name.trim()],
    })
  } catch (e: any) {
    // Table doesn't exist — create it first
    try {
      await db.execute({ sql: 'CREATE TABLE IF NOT EXISTS Skill (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, createdAt TEXT NOT NULL)' })
      await db.execute({
        sql: "INSERT INTO Skill (id, name, createdAt) VALUES (?, ?, datetime('now'))",
        args: [id, name.trim()],
      })
    } catch (e2: any) {
      if (String(e2.message).includes('UNIQUE')) {
        return NextResponse.json({ error: 'Skill already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 })
    }
  }

  return NextResponse.json({ id, name: name.trim() }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    await db.execute({ sql: 'DELETE FROM Skill WHERE id = ?', args: [id] })
  } catch (e: any) {
    // Table doesn't exist — nothing to delete
  }

  return NextResponse.json({ ok: true })
}
