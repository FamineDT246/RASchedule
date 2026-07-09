import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/invites — list all invited users (admin only)
export async function GET() {
  const users = await db.user.findMany({
    include: { profile: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    profileId: u.profileId,
    profileName: u.profile?.name ?? null,
    inviteToken: u.inviteToken,
    claimedAt: u.claimedAt?.toISOString() ?? null,
    inviteExpiresAt: u.inviteExpiresAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  })))
}

// POST /api/invites
// Body: { name: string, profileId?: string, expiresInDays?: number }
// Creates a new instructor user with an invite token, optionally linked to an existing Profile.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, profileId, expiresInDays } = body as {
    name: string
    profileId?: string
    expiresInDays?: number
  }
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId } })
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const user = await db.user.create({
    data: {
      name,
      role: 'instructor',
      profileId: profileId ?? null,
      inviteExpiresAt: expiresAt,
    },
    include: { profile: true },
  })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    inviteToken: user.inviteToken,
    profileId: user.profileId,
    profileName: user.profile?.name ?? null,
  }, { status: 201 })
}

// DELETE /api/invites?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
