import { NextResponse } from 'next/server'
import { execSync } from 'node:child_process'

// POST /api/seed — re-runs the seed script and returns success/failure.
export async function POST() {
  try {
    const out = execSync('bun run scripts/seed.ts', {
      cwd: '/home/z/my-project',
      encoding: 'utf-8',
      timeout: 30_000,
    })
    return NextResponse.json({ ok: true, output: out.split('\n').slice(-8) })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    )
  }
}
