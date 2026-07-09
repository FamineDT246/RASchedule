'use client'

import {
  hostColor,
  formatTime,
  formatPrettyDate,
  formatShortDate,
  eventOnDate,
  addDaysISO,
  SHIRT_COLOR_SWATCH,
  type EventView,
  type AssignmentView,
} from '@/lib/scheduler-types'
import { cn } from '@/lib/utils'

type Props = {
  weekStartISO: string
  events: EventView[]
  assignments: AssignmentView[]
}

function weekDates(weekStartISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i))
}

// Generate CSV string from the week's schedule
export function generateCSV(weekStartISO: string, events: EventView[], assignments: AssignmentView[]): string {
  const dates = weekDates(weekStartISO)
  const rows: string[][] = []

  // Header row
  rows.push(['Date', 'Day', 'Event', 'Host', 'Code', 'Start Time', 'End Time', 'Location', 'Status', 'Participants', 'Needed/Day', 'Assigned Today', 'Instructor', 'Role', 'Shirt', 'Type'])

  for (const dateISO of dates) {
    const dayEvents = events.filter(e => eventOnDate(e, dateISO))
    if (dayEvents.length === 0) {
      const d = new Date(`${dateISO}T00:00:00.000Z`)
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      rows.push([dateISO, dayName, '— No events —', '', '', '', '', '', '', '', '', '', '', '', ''])
      continue
    }

    for (const ev of dayEvents) {
      const evAssignments = assignments.filter(a => a.eventId === ev.id && a.date === dateISO)
      const primaries = evAssignments.filter(a => !a.isAlternative)
      const alts = evAssignments.filter(a => a.isAlternative)
      const all = [...primaries, ...alts]

      const d = new Date(`${dateISO}T00:00:00.000Z`)
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })

      if (all.length === 0) {
        rows.push([
          dateISO, dayName, ev.name, ev.host, ev.code ?? '', ev.startTime, ev.endTime,
          ev.location ?? '', ev.status, String(ev.participantCount ?? ''), String(ev.requiredInstructors), '0',
          '— Unfilled —', '', '', '',
        ])
      } else {
        for (const a of all) {
          rows.push([
            dateISO, dayName, ev.name, ev.host, ev.code ?? '', ev.startTime, ev.endTime,
            ev.location ?? '', ev.status, String(ev.participantCount ?? ''), String(ev.requiredInstructors), String(primaries.length),
            a.profileName, a.profileRoleTier, a.shirtColor ?? '',
            a.isAlternative ? 'Alternative' : 'Primary',
          ])
        }
      }
    }
  }

  // Convert to CSV with proper escaping
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }).join(',')
  ).join('\n')
}

// Download a string as a file
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Export CSV
export function exportCSV(weekStartISO: string, events: EventView[], assignments: AssignmentView[]) {
  const csv = generateCSV(weekStartISO, events, assignments)
  const dates = weekDates(weekStartISO)
  const filename = `robot-adventure-schedule-${dates[0]}-to-${dates[6]}.csv`
  downloadFile(filename, csv, 'text/csv;charset=utf-8;')
}
