import { createClient } from '@libsql/client'

const globalForDb = globalThis as unknown as {
  libsqlClient: ReturnType<typeof createClient> | undefined
}

function createDbClient() {
  const url = process.env.TURSO_URL || process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL or TURSO_URL environment variable is not set')
  }

  // Turso / libsql connection
  if (url.startsWith('libsql://')) {
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
    return createClient({ url, authToken })
  }

  // Local SQLite
  return createClient({ url })
}

export const db = globalForDb.libsqlClient ?? createDbClient()

if (process.env.NODE_ENV !== 'production') globalForDb.libsqlClient = db
