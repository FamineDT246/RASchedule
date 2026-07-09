import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // If it's a libsql:// URL, use the libSQL adapter (Turso)
  if (url.startsWith('libsql://')) {
    const authToken = process.env.DATABASE_AUTH_TOKEN
    const libsql = createClient({ url, authToken })
    const adapter = new PrismaLibSql(libsql)
    // When using the adapter, Prisma still reads DATABASE_URL for the datasource
    // block validation, but it's not actually used for connections.
    process.env.DATABASE_URL = 'file:./db/placeholder.db'
    return new PrismaClient({ adapter } as any)
  }

  // Otherwise, fall back to regular SQLite (local dev)
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query'] : [],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
