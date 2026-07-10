// Pure conflict-detection logic for the RA Syncbot scheduler.
// Imported by both server (API route) and client (UI ring feedback).

export type ConflictLevel = 'ok' | 'warning' | 'error'

export type ConflictResult = {
  level: ConflictLevel
  reasons: string[]
}

export type ProfileLite = {
  id: string
  name: string
  roleTier: string // Chief | Senior | Junior | Assistant | Intern
  skills: string[] // parsed from comma-separated
  unavailable: string[] // YYYY-MM-DD
}

export type AssignmentLite = {
  id: string
  profileId: string
  assignedDate: string // YYYY-MM-DD
  startTime: string // "09:00"
  endTime: string // "15:00"
  eventName: string
}

export type EventLite = {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  startTime: string
  endTime: string
  requiredInstructors: number
  requiredSkills: string[]
  currentAssignees: number // already-assigned count for the target date
}

// ---------- Helpers ----------

export function parseSkills(raw?: string): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

export function parseDates(raw?: string): string[] {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

// Convert "09:00" → minutes since midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function timeRangesOverlap(
  startA: string, endA: string, startB: string, endB: string,
): boolean {
  const sA = timeToMinutes(startA)
  const eA = timeToMinutes(endA)
  const sB = timeToMinutes(startB)
  const eB = timeToMinutes(endB)
  return sA < eB && sB < eA
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------- The three checks from the blueprint ----------

/**
 * Check 1 — Temporal Overlap (Double-Booking).
 * Hard error if the same person is already assigned to another event
 * whose time block overlaps on the same day.
 */
export function checkTemporalOverlap(
  profile: ProfileLite,
  date: string,
  event: EventLite,
  existing: AssignmentLite[],
): ConflictResult {
  const reasons: string[] = []
  for (const a of existing) {
    if (a.profileId !== profile.id) continue
    if (a.assignedDate !== date) continue
    if (timeRangesOverlap(event.startTime, event.endTime, a.startTime, a.endTime)) {
      reasons.push(
        `Already assigned to "${a.eventName}" ${a.startTime}–${a.endTime} on ${date}`,
      )
    }
  }
  return { level: reasons.length ? 'error' : 'ok', reasons }
}

/**
 * Check 1b — Availability.
 * Hard error if the person is marked unavailable on the target date.
 */
export function checkAvailability(
  profile: ProfileLite,
  date: string,
): ConflictResult {
  if (profile.unavailable.includes(date)) {
    return {
      level: 'error',
      reasons: [`Marked unavailable on ${date}`],
    }
  }
  return { level: 'ok', reasons: [] }
}

/**
 * Check 2 — Skill & Role Matching (INFORMATIONAL, non-blocking).
 *
 * Returns a soft warning listing which required skills the instructor doesn't have.
 * This never blocks assignment — the boss can assign anyone. The warning is shown
 * so the boss knows who might need practice gear (drones, robots, etc.).
 */
export function checkSkillMatch(
  profile: ProfileLite,
  event: EventLite,
): ConflictResult {
  const reasons: string[] = []
  const missing = event.requiredSkills.filter(s => !profile.skills.includes(s))
  if (missing.length > 0) {
    reasons.push(`Missing skills: ${missing.join(', ')}`)
  }
  return { level: reasons.length ? 'warning' : 'ok', reasons }
}

/**
 * Get the list of missing skills for a profile on an event.
 * Used by the UI to show "Needs practice: Drones, Python" badges.
 */
export function getMissingSkills(
  profileSkills: string[],
  eventSkills: string[],
): string[] {
  return eventSkills.filter(s => !profileSkills.includes(s))
}

/**
 * Check 3 — Fatigue Tracking.
 * Soft warning if assigning the person would push them past 5 consecutive
 * working days.
 */
export function checkFatigue(
  profile: ProfileLite,
  date: string,
  existing: AssignmentLite[],
): ConflictResult {
  const myDates = new Set(
    existing
      .filter(a => a.profileId === profile.id)
      .map(a => a.assignedDate),
  )
  myDates.add(date)

  // Walk backwards from `date` to count consecutive working days
  let back = 0
  let cursor = date
  while (myDates.has(cursor)) {
    back++
    cursor = addDaysISO(cursor, -1)
  }
  // Walk forwards
  let fwd = 0
  cursor = date
  while (myDates.has(cursor)) {
    fwd++
    cursor = addDaysISO(cursor, 1)
  }
  const streak = back + fwd - 1 // `date` counted twice
  if (streak > 5) {
    return {
      level: 'warning',
      reasons: [`Would create a ${streak}-day consecutive work streak (max 5)`],
    }
  }
  return { level: 'ok', reasons: [] }
}

/**
 * Run all checks and return the highest-severity result.
 * Error > Warning > OK.
 */
export function runAllChecks(args: {
  profile: ProfileLite
  date: string
  event: EventLite
  existing: AssignmentLite[]
}): ConflictResult {
  const { profile, date, event, existing } = args
  const checks = [
    checkAvailability(profile, date),
    checkTemporalOverlap(profile, date, event, existing),
    checkSkillMatch(profile, event),
    checkFatigue(profile, date, existing),
  ]
  const allReasons: string[] = []
  let level: ConflictLevel = 'ok'
  for (const c of checks) {
    if (c.level === 'error') level = 'error'
    else if (c.level === 'warning' && level !== 'error') level = 'warning'
    allReasons.push(...c.reasons)
  }
  return { level, reasons: allReasons }
}

/**
 * Capacity check — how many more instructors does the event need on this date?
 */
export function capacityStatus(event: EventLite): {
  filled: number
  needed: number
  isFull: boolean
} {
  const filled = event.currentAssignees
  const needed = event.requiredInstructors
  return { filled, needed, isFull: filled >= needed }
}
