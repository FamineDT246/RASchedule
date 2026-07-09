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
  shirtSize: string | null
  shirtType: string | null
  shirtColors: string | null
  available: string | null
  contractSigned: boolean
  notes: string | null
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
  status: string
  ageRange: string | null
  participantCount: number | null
  requiredInstructors: number
  notes: string | null
  requiredSkills: string[]
}

export type AssignmentView = {
  id: string
  eventId: string
  profileId: string
  date: string // YYYY-MM-DD
  status: string
  overrideFlag: boolean
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

// ---------- Date helpers ----------

export function isoWeekdaysInRange(fromISO: string, toISO: string): string[] {
  // Returns all dates from..to inclusive (UTC). Caller filters weekdays if needed.
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
export function eventOnDate(ev: EventView, dateISO: string): boolean {
  return ev.startDate <= dateISO && ev.endDate >= dateISO
}
