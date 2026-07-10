import { NextResponse } from 'next/server'

// POST /api/seed — DISABLED in production for security
// This endpoint could wipe the entire database. It's only available in development.
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seed endpoint is disabled in production' },
      { status: 403 },
    )
  }
  return NextResponse.json(
    { error: 'Seed endpoint is disabled. Use bun run scripts/seed.ts locally.' },
    { status: 403 },
  )
}
