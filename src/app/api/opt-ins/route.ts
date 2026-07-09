import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '../auth/me/route'

// GET /api/opt-ins?eventId=... — list opt-ins (optionally filtered by event)
// If the caller is an instructor, only their own opt-ins are returned.
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')

  const where: Record<string, unknown> = {}
  if (eventId) where.eventId = eventId
  if (user.role === 'instructor') where.userId = user.id

  const optIns = await db.optIn.findMany({
    where,
    include: { event: true, user: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(optIns.map(o => ({
    id: o.id,
    userId: o.userId,
    userName: o.user.name,
    userProfileId: o.user.profileId ?? null,
    userProfileName: o.user.profile?.name ?? null,
    eventId: o.eventId,
    eventName: o.event.name,
    status: o.status,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
  })))
}

// POST /api/opt-ins
// Body: { eventId, status: 'interested' | 'available' | 'unavailable', note? }
// Instructors only. Upserts the opt-in for the current user.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (user.role !== 'instructor') {
    return NextResponse.json({ error: 'Admins cannot opt in' }, { status: 403 })
  }

  const body = await req.json()
  const { eventId, status, note } = body as {
    eventId: string
    status: string
    note?: string
  }
  if (!eventId || !['interested', 'available', 'unavailable'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updated = await db.optIn.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    create: { userId: user.id, eventId, status, note: note ?? null },
    update: { status, note: note ?? null },
  })
  return NextResponse.json(updated, { status: 201 })
}
