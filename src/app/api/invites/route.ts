import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from '@/lib/db'

// GET /api/invites
export async function GET(req: NextRequest) {
  const authGet = await requireAdmin(req); if (authGet) return authGet;
  const result = await db.execute({
    sql: `SELECT u.*, p.name as profileName FROM User u LEFT JOIN Profile p ON u.profileId = p.id ORDER BY u.createdAt DESC`,
  })

  return NextResponse.json(result.rows.map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    profileId: u.profileId,
    profileName: u.profileName,
    inviteToken: u.inviteToken,
    claimedAt: u.claimedAt ? new Date(u.claimedAt).toISOString() : null,
    inviteExpiresAt: u.inviteExpiresAt ? new Date(u.inviteExpiresAt).toISOString() : null,
    createdAt: new Date(u.createdAt).toISOString(),
  })))
}

// POST /api/invites — create invite linked to existing staff
const authPost = await requireAdmin(req); if (authPost) return authPost;
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, profileId } = body as { name: string; profileId?: string }
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  if (profileId) {
    const profile = await db.execute({ sql: 'SELECT id FROM Profile WHERE id = ?', args: [profileId] })
    if (profile.rows.length === 0) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const id = crypto.randomUUID()
  const inviteToken = crypto.randomUUID()

  await db.execute({
    sql: `INSERT INTO User (id, name, role, profileId, inviteToken, createdAt, updatedAt)
          VALUES (?, ?, 'instructor', ?, ?, datetime('now'), datetime('now'))`,
    args: [id, name, profileId ?? null, inviteToken],
  })

  const result = await db.execute({ sql: 'SELECT * FROM User WHERE id = ?', args: [id] })
  const u = result.rows[0] as any
  return NextResponse.json({
    id: u.id,
    name: u.name,
    inviteToken: u.inviteToken,
    profileId: u.profileId,
  }, { status: 201 })
}

// DELETE /api/invites?id=...
const authDel = await requireAdmin(req); if (authDel) return authDel;
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM User WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
