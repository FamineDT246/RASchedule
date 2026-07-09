// Database helper for @libsql/client (Turso/SQLite)
// Provides Prisma-like convenience methods using raw SQL

import { db } from './db'

export type Row = Record<string, unknown>

export async function query(sql: string, args: unknown[] = []): Promise<Row[]> {
  const result = await db.execute({ sql, args })
  return result.rows as Row[]
}

export async function queryOne(sql: string, args: unknown[] = []): Promise<Row | null> {
  const rows = await query(sql, args)
  return rows[0] ?? null
}

export async function execute(sql: string, args: unknown[] = []): Promise<void> {
  await db.execute({ sql, args })
}

// Generate a CUID-like ID
export function genId(): string {
  return crypto.randomUUID()
}

// Parse comma-separated string into array
export function parseList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

// Format array into comma-separated string
export function formatList(arr: string[]): string {
  return arr.join(',')
}
