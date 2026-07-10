import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'

function parseList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

// GET /api/events — list all events
export async function GET() {
  const result = await db.execute(`SELECT * FROM Event ORDER BY startDate ASC`)

  // Get skills + assignment counts + opt-in counts
  const events = []
  for (const e of result.rows as any[]) {
    const skills = await db.execute({ sql: 'SELECT skillName FROM EventSkill WHERE eventId = ?', args: [e.id] })
    const assignments = await db.execute({ sql: 'SELECT COUNT(*) as count FROM Assignment WHERE eventId = ?', args: [e.id] })
    const optIns = await db.execute({ sql: 'SELECT COUNT(*) as count FROM OptIn WHERE eventId = ?', args: [e.id] })
    events.push({
      ...e,
      startDate: e.startDate?.slice(0, 10),
      endDate: e.endDate?.slice(0, 10),
      specificDatesList: parseList(e.specificDates),
      requiredSkills: skills.rows.map((s: any) => s.skillName),
      _assignmentCount: (assignments.rows[0] as any).count,
      _optInCount: (optIns.rows[0] as any).count,
    })
  }

  return NextResponse.json(events)
}

// POST /api/events — create
export async function POST(req: NextRequest) {
  const authCheck = await requireAdmin(req); if (authCheck) return authCheck;
  const body = await req.json()
  const id = crypto.randomUUID()

  await db.execute({
    sql: `INSERT INTO Event (id, code, name, host, location, description, lengthDays, startDate, endDate, 
          startTime, endTime, status, specificDates, ageRange, participantCount, requiredInstructors, 
          notes, hostColor, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    args: [
      id, body.code ?? null, body.name, body.host, body.location ?? null, body.description ?? null,
      body.lengthDays ?? null,
      new Date(body.startDate).toISOString(),
      new Date(body.endDate).toISOString(),
      body.startTime ?? '09:00', body.endTime ?? '15:00',
      body.status ?? 'Confirmed',
      Array.isArray(body.specificDates) && body.specificDates.length ? body.specificDates.join(',') : null,
      body.ageRange ?? null, body.participantCount ?? null, body.requiredInstructors ?? 2,
      body.notes ?? null, body.hostColor ?? 'slate',
    ],
  })

  // Insert skills
  if (Array.isArray(body.skills)) {
    for (const skillName of body.skills) {
      await db.execute({
        sql: 'INSERT INTO EventSkill (id, eventId, skillName) VALUES (?, ?, ?)',
        args: [crypto.randomUUID(), id, skillName],
      })
    }
  }

  const result = await db.execute({ sql: 'SELECT * FROM Event WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0], { status: 201 })
}

// PUT /api/events?id=...
export async function PUT(req: NextRequest) {
  const authCheck2 = await requireAdmin(req); if (authCheck2) return authCheck2;
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const body = await req.json()

  // Replace skills if provided
  if (Array.isArray(body.skills)) {
    await db.execute({ sql: 'DELETE FROM EventSkill WHERE eventId = ?', args: [id] })
    for (const skillName of body.skills) {
      await db.execute({
        sql: 'INSERT INTO EventSkill (id, eventId, skillName) VALUES (?, ?, ?)',
        args: [crypto.randomUUID(), id, skillName],
      })
    }
  }

  const updates: string[] = []
  const args: unknown[] = []
  const fields: Record<string, string> = {
    code: 'code', name: 'name', host: 'host', hostColor: 'hostColor',
    location: 'location', description: 'description', lengthDays: 'lengthDays',
    startTime: 'startTime', endTime: 'endTime', status: 'status',
    ageRange: 'ageRange', participantCount: 'participantCount',
    requiredInstructors: 'requiredInstructors', notes: 'notes',
  }

  for (const [key, col] of Object.entries(fields)) {
    if (key in body) {
      updates.push(`${col} = ?`)
      args.push(body[key] ?? null)
    }
  }

  if (typeof body.startDate === 'string') {
    updates.push('startDate = ?')
    args.push(new Date(body.startDate).toISOString())
  }
  if (typeof body.endDate === 'string') {
    updates.push('endDate = ?')
    args.push(new Date(body.endDate).toISOString())
  }
  if ('specificDates' in body) {
    updates.push('specificDates = ?')
    args.push(Array.isArray(body.specificDates) && body.specificDates.length ? body.specificDates.join(',') : null)
  }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')")
    args.push(id)
    await db.execute({ sql: `UPDATE Event SET ${updates.join(', ')} WHERE id = ?`, args })
  }

  const result = await db.execute({ sql: 'SELECT * FROM Event WHERE id = ?', args: [id] })
  return NextResponse.json(result.rows[0])
}

// DELETE /api/events?id=...
export async function DELETE(req: NextRequest) {
  const authCheck3 = await requireAdmin(req); if (authCheck3) return authCheck3;
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM Event WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
