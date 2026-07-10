import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from './me/route'

// Helper: require admin auth for a route handler
// Usage: export async function GET(req: NextRequest) {
//   const authCheck = await requireAdmin(req)
//   if (authCheck) return authCheck  // returns 401/403 response if not admin
//   ...your route logic
// }
export async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return null // null means authorized
}

// Helper: require any authenticated user (admin or instructor)
export async function requireAuth(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return null
}
