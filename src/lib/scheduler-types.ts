// Shared types for the scheduler UI, mirroring what /api/schedule returns.
export type ProfileView = {
  id: string
  name: string
  sex: string | null
  role: string
  roleTier: string
  skills: string
  skillsList: string[]
  unavailable: string | null
  unavailableList: string[]
  available: string | null
  contractSigned: boolean
  notes: string | null
}

export type OptInEntry = {
  id: string
  status: string
  note: string | null
  userId: string
  userName: string
  userProfileId: string | null
  userProfileName: string | null
}

export type OptInGroup = {
  interested: OptInEntry[]
  available: OptInEntry[]
  unavailable: OptInEntry[]
}

export type EventView = {
  id: string
  code: string | null
  name: string
  host: string
  hostColor: string
  location: string | null
  description: string | null
  lengthDays: number | null
  startDate: string // YYYY-MM-DD
  endDate: string
  startTime: string
  endTime: string
  status: string // Draft | Tentative | Confirmed | Cancelled
  specificDates: string | null
  specificDatesList: string[]
  ageRange: string | null
  participantCount: number | null
  requiredInstructors: number
  notes: string | null
  requiredSkills: string[]
  optIns?: OptInGroup
}

export type AssignmentView = {
  id: string
  eventId: string
  profileId: string
  date: string // YYYY-MM-DD
  status: string
  isAlternative: boolean
  shirtColor: string | null
  profileName: string
  profileRoleTier: string
  eventName: string
  eventHostColor: string
}

export type ScheduleData = {
  profiles: ProfileView[]
  events: EventView[]
  assignments: AssignmentView[]
}

export type AuthUser = {
  id: string
  name: string
  email: string | null
  role: 'admin' | 'instructor'
  profileId: string | null
  profile: {
    id: string
    name: string
    roleTier: string
    role: string
    skills: string
    unavailable: string | null
  } | null
}

export type InviteView = {
  id: string
  name: string
  email: string | null
  role: string
  profileId: string | null
  profileName: string | null
  inviteToken: string
  claimedAt: string | null
  inviteExpiresAt: string | null
  createdAt: string
}

export type OptInView = {
  id: string
  userId: string
  userName: string
  userProfileId: string | null
  userProfileName: string | null
  eventId: string
  eventName: string
  status: 'interested' | 'available' | 'unavailable'
  note: string | null
  createdAt: string
}

// Tailwind class maps — keep the palette consistent & avoid indigo/blue.
export const HOST_COLOR_CLASSES: Record<string, { chip: string; bar: string; dot: string }> = {
  teal:    { chip: 'bg-teal-500/15 text-teal-300 border-teal-500/30',    bar: 'bg-teal-500',    dot: 'bg-teal-400' },
  emerald: { chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', bar: 'bg-emerald-500', dot: 'bg-emerald-400' },
  amber:   { chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30', bar: 'bg-amber-500',   dot: 'bg-amber-400' },
  pink:    { chip: 'bg-pink-500/15 text-pink-300 border-pink-500/30',    bar: 'bg-pink-500',    dot: 'bg-pink-400' },
  rose:    { chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',    bar: 'bg-rose-500',    dot: 'bg-rose-400' },
  slate:   { chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30', bar: 'bg-slate-500',   dot: 'bg-slate-400' },
}

export function hostColor(key: string) {
  return HOST_COLOR_CLASSES[key] ?? HOST_COLOR_CLASSES.slate
}

// Shirt color → swatch class (used for the per-assignment shirt color picker)
export const SHIRT_COLORS = [
  'Orange', 'Purple', 'Blue', 'Grey', 'Black', 'Turquoise', 'Green', 'White',
] as const

export const SHIRT_COLOR_SWATCH: Record<string, string> = {
  Orange: 'bg-orange-500',
  Purple: 'bg-purple-500',
  Blue: 'bg-blue-500',
  Grey: 'bg-zinc-400',
  Black: 'bg-zinc-900 border border-zinc-600',
  Turquoise: 'bg-teal-400',
  Green: 'bg-emerald-500',
  White: 'bg-white border border-zinc-300',
}

export const ROLE_TIER_COLOR: Record<string, string> = {
  Chief:     'text-amber-300 bg-amber-500/10 border-amber-500/30',
  Senior:    'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Junior:    'text-teal-300 bg-teal-500/10 border-teal-500/30',
  Assistant: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  Intern:    'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
}

export function roleColor(tier: string) {
  return ROLE_TIER_COLOR[tier] ?? ROLE_TIER_COLOR.Intern
}

export const EVENT_STATUS_COLOR: Record<string, string> = {
  Draft:     'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  Tentative: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

// ---------- Date helpers ----------

// All date comparisons use America/Barbados time (AST, UTC-4).
// The boss and instructors are all in Barbados, so "today" should be Barbados-today.
const BBD_TZ = 'America/Barbados'

export function todayInBarbados(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BBD_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date()) // en-CA gives YYYY-MM-DD
}

export function isoWeekdaysInRange(fromISO: string, toISO: string): string[] {
  const out: string[] = []
  const d = new Date(`${fromISO}T00:00:00.000Z`)
  const end = new Date(`${toISO}T00:00:00.000Z`)
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export function startOfWeekISO(iso: string): string {
  // Monday-based week start
  const d = new Date(`${iso}T00:00:00.000Z`)
  const day = d.getUTCDay() // 0=Sun .. 6=Sat
  const offset = (day === 0 ? 6 : day - 1)
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatPrettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function formatDayNum(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  return String(d.getUTCDate())
}

// 24-hour "09:00" → "9:00 AM"
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m || 0).padStart(2, '0')} ${ampm}`
}

// Does the event fall on the given date?
// Honors specificDates if set (event only runs on those dates).
export function eventOnDate(ev: EventView, dateISO: string): boolean {
  // Draft events never show on the calendar regardless of dates
  if (ev.status === 'Draft') return false
  // Cancelled events still show (greyed out) so the boss can see history
  if (ev.specificDatesList && ev.specificDatesList.length > 0) {
    return ev.specificDatesList.includes(dateISO)
  }
  return ev.startDate <= dateISO && ev.endDate >= dateISO
}
