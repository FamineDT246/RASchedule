import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import { getSessionFromRequest } from './session'

/**
 * Get the authenticated user from a signed session cookie.
 * The cookie is encrypted (iron-session), so it can't be forged.
 */
export async function getAuthUser(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session.userId) return null

  const result = await db.execute({
    sql: `SELECT u.*, p.name as profileName, p.roleTier as profileRoleTier, p.role as profileRole,
          p.skills as profileSkills, p.unavailable as profileUnavailable, p.id as profileId
          FROM User u LEFT JOIN Profile p ON u.profileId = p.id WHERE u.id = ?`,
    args: [session.userId],
  })

  if (result.rows.length === 0) return null
  const row = result.rows[0] as any
  if (!row.claimedAt) return null

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    profileId: row.profileId ?? null,
    passwordHash: row.passwordHash,
    claimedAt: row.claimedAt,
    emailNotifications: row.emailNotifications === null || row.emailNotifications === undefined ? true : !!row.emailNotifications,
    profile: row.profileId ? {
      id: row.profileId,
      name: row.profileName,
      roleTier: row.profileRoleTier,
      role: row.profileRole,
      skills: row.profileSkills,
      unavailable: row.profileUnavailable,
    } : null,
  }
}

/**
 * Require admin auth for a route handler.
 * Returns a 401/403 response if not admin, or null if authorized.
 */
export async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return null
}

/**
 * Require any authenticated user (admin or instructor).
 */
export async function requireAuth(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return null
}
