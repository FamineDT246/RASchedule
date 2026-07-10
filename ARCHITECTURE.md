# Architecture

This document explains how the codebase is structured and how things work, aimed at developers who will maintain or extend the app.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Scheduler │  │ Calendar │  │  Events  │  │   Team   │  │
│  │   Tab    │  │   Tab    │  │   Tab    │  │   Tab    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       └──────────┬───┴──────────┬───┴──────────┬────────┘  │
│              TanStack Query (fetch + cache)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP (fetch)
┌──────────────────────┴──────────────────────────────────────┐
│                   Next.js API Routes                         │
│  /api/schedule  /api/events  /api/profiles  /api/auth/*    │
│  /api/assignments  /api/invites  /api/opt-ins              │
│  Each route checks auth (requireAdmin/requireAuth)          │
└──────────────────────┬──────────────────────────────────────┘
                       │ libSQL protocol
┌──────────────────────┴──────────────────────────────────────┐
│                    Turso (libSQL)                            │
│  SQLite-compatible cloud database                           │
│  Tables: Profile, Event, EventSkill, Assignment, User, OptIn│
└─────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. No ORM — Raw SQL via @libsql/client

The app uses `@libsql/client` directly (no Prisma, no Drizzle). This was a deliberate choice:

- **Why:** Prisma's driver adapter for Turso had runtime issues on Vercel serverless. Raw SQL via `@libsql/client` is simpler, more reliable, and has zero cold-start overhead.
- **Trade-off:** More verbose query code, but full control and no abstraction bugs.
- **Pattern:** Every API route imports `db` from `@/lib/db` and uses `db.execute({ sql, args })`.

**Example:**
```typescript
import { db } from '@/lib/db'

const result = await db.execute({
  sql: 'SELECT * FROM Profile WHERE id = ?',
  args: [profileId],
})
const profile = result.rows[0]
```

### 2. Auth via httpOnly Cookies

- Login sets a `ra-user-id` cookie containing the user's UUID.
- The cookie is `httpOnly` (can't be read by JavaScript), `sameSite: lax`, 30-day expiry.
- Every API route that modifies data calls `requireAdmin(req)` which reads the cookie, looks up the user, and checks `role === 'admin'`.
- Instructors can only call read-only endpoints (schedule, opt-ins, profiles/me).

**Auth helper pattern:**
```typescript
import { requireAdmin } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  const authCheck = await requireAdmin(req)
  if (authCheck) return authCheck  // returns 401/403 if not admin
  // ... your code
}
```

### 3. Single-Page App with Tab Navigation

The entire app is a single Next.js route (`/`). All "pages" are tabs rendered conditionally:

```typescript
type Tab = 'scheduler' | 'calendar' | 'events' | 'team' | 'conflicts' | 'workload' | 'invites'
```

This means:
- No routing complexity
- State persists when switching tabs
- Fast navigation (no page reloads)
- The back button is intercepted to prevent accidental exits

### 4. View Mode: Desktop Drag-Drop vs Mobile Tap-to-Assign

The `useIsMobile()` hook detects viewport width (< 640px). Based on this:

- **Desktop:** `PointerSensor` + `TouchSensor` from `@dnd-kit/core` enable drag-and-drop
- **Mobile:** Sensors are disabled (activation distance = 9999). Instead:
  1. Tap an instructor in the roster → they get selected (emerald ring)
  2. Tap an event card → the instructor is assigned to that event+date
  3. A floating bar shows who's selected with a cancel button

### 5. Past Date Protection

- **Frontend:** Event cards on past dates have `disabled` droppable targets, no hover effects, 60% opacity
- **Backend:** `POST /api/assignments` checks if the date is before today (Barbados time) and returns 400
- **Bulk assign:** Past dates are skipped (counted as `skippedPast`)

### 6. Auto-Archive

When the schedule loads, a fire-and-forget `POST /api/auto-archive` call runs. It:
- Finds events whose `endDate` is before today
- Sets their status to `Archived`
- Archived events don't appear on the calendar or scheduler (only in the Events tab)

---

## File Responsibilities

### `src/lib/db.ts`
Creates and exports the database client. Detects whether to use Turso (cloud) or local SQLite based on environment variables.

### `src/lib/auth-helpers.ts`
Exports `requireAdmin(req)` and `requireAuth(req)`. These read the auth cookie, look up the user, and return a 401/403 response if unauthorized (or `null` if authorized).

### `src/lib/conflicts.ts`
Pure functions for conflict detection:
- `checkAvailability()` — is the instructor marked unavailable on that date?
- `checkTemporalOverlap()` — is the instructor already booked at an overlapping time?
- `checkSkillMatch()` — (disabled, no-op — boss assigns whoever they want)
- `checkFatigue()` — would this create a >5-day consecutive work streak?
- `runAllChecks()` — runs all checks and returns the highest severity

### `src/lib/scheduler-types.ts`
Shared TypeScript types (`EventView`, `AssignmentView`, `ProfileView`, etc.), color maps for host colors and role tiers, and all date helper functions (`todayInBarbados()`, `isPastDate()`, `eventOnDate()`, `formatTime()`, etc.).

### `src/lib/export-utils.ts`
CSV generation and file download utilities. `generateCSV()` builds the CSV string from the week's data; `downloadFile()` triggers a browser download.

### `src/app/page.tsx`
The main page — this is the heart of the app. It handles:
- Auth state (login gate, claim flow, instructor vs admin routing)
- Tab navigation
- All mutations (assign, remove, patch, bulk assign, reseed, change password)
- Drag-and-drop and tap-to-assign handlers
- Print mode and PWA install prompt
- The back-button interceptor

### `src/app/providers.tsx`
Wraps the app with `QueryClientProvider` (TanStack Query), `ThemeProvider` (next-themes), and the Sonner `Toaster`.

---

## Database Schema (SQL)

```sql
CREATE TABLE Profile (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sex             TEXT,
  role            TEXT NOT NULL,
  roleTier        TEXT NOT NULL,
  skills          TEXT NOT NULL,
  available       TEXT,
  unavailable     TEXT,
  contractSigned  BOOLEAN NOT NULL DEFAULT 0,
  notes           TEXT,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL
);

CREATE TABLE Event (
  id                  TEXT PRIMARY KEY,
  code                TEXT,
  name                TEXT NOT NULL,
  host                TEXT NOT NULL,
  location            TEXT,
  description         TEXT,
  lengthDays          INTEGER,
  startDate           DATETIME NOT NULL,
  endDate             DATETIME NOT NULL,
  startTime           TEXT NOT NULL,
  endTime             TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Confirmed',
  specificDates       TEXT,
  ageRange            TEXT,
  participantCount    INTEGER,
  requiredInstructors INTEGER NOT NULL DEFAULT 2,
  notes               TEXT,
  hostColor           TEXT NOT NULL DEFAULT 'slate',
  createdAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt           DATETIME NOT NULL
);

CREATE TABLE EventSkill (
  id        TEXT PRIMARY KEY,
  eventId   TEXT NOT NULL,
  skillName TEXT NOT NULL,
  FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE CASCADE
);

CREATE TABLE Assignment (
  id            TEXT PRIMARY KEY,
  eventId       TEXT NOT NULL,
  profileId     TEXT NOT NULL,
  assignedDate  DATETIME NOT NULL,
  status        TEXT NOT NULL DEFAULT 'Assigned',
  isAlternative BOOLEAN NOT NULL DEFAULT 0,
  shirtColor    TEXT,
  notes         TEXT,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME NOT NULL,
  FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE CASCADE,
  FOREIGN KEY (profileId) REFERENCES Profile(id) ON DELETE CASCADE
);

CREATE TABLE User (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'instructor',
  passwordHash    TEXT,
  profileId       TEXT,
  inviteToken     TEXT UNIQUE NOT NULL,
  inviteExpiresAt DATETIME,
  claimedAt       DATETIME,
  createdAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME NOT NULL,
  FOREIGN KEY (profileId) REFERENCES Profile(id)
);

CREATE TABLE OptIn (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL,
  eventId   TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'interested',
  note      TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
  FOREIGN KEY (eventId) REFERENCES Event(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_profile_roleTier ON Profile(roleTier);
CREATE INDEX idx_event_startDate ON Event(startDate);
CREATE INDEX idx_event_host ON Event(host);
CREATE INDEX idx_event_status ON Event(status);
CREATE INDEX idx_eventSkill_skillName ON EventSkill(skillName);
CREATE UNIQUE INDEX idx_eventSkill_eventId_skillName ON EventSkill(eventId, skillName);
CREATE INDEX idx_assignment_profileId_assignedDate ON Assignment(profileId, assignedDate);
CREATE INDEX idx_assignment_eventId_assignedDate ON Assignment(eventId, assignedDate);
CREATE UNIQUE INDEX idx_assignment_eventId_profileId_assignedDate ON Assignment(eventId, profileId, assignedDate);
CREATE INDEX idx_user_role ON User(role);
CREATE INDEX idx_optIn_eventId ON OptIn(eventId);
CREATE UNIQUE INDEX idx_optIn_userId_eventId ON OptIn(userId, eventId);
```

---

## Adding a New Feature

### Example: Adding a new API endpoint

1. Create `src/app/api/your-endpoint/route.ts`
2. Import `db` and `requireAdmin` (if it's an admin-only endpoint)
3. Write the handler:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-helpers'

export async function GET() {
  const result = await db.execute('SELECT * FROM SomeTable')
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdmin(req)
  if (authCheck) return authCheck

  const body = await req.json()
  // ... your logic
  return NextResponse.json({ ok: true })
}
```

### Example: Adding a new tab

1. Create the component in `src/components/scheduler/YourTab.tsx`
2. Add the tab type: `'yourtab'` in `type Tab` in `src/app/page.tsx`
3. Add the tab button in the `<nav>` section
4. Add the render: `{tab === 'yourtab' && <YourTab />}`

### Example: Adding a new database column

1. Add the column via a SQL migration script (or directly in Turso's web inspector)
2. Update the corresponding API route to include the new column in INSERT/SELECT
3. Update the TypeScript type in `src/lib/scheduler-types.ts`
4. Update the UI component that displays/edits the field

---

## Common Patterns

### Fetching data (TanStack Query)

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['schedule'],
  queryFn: async () => {
    const r = await fetch('/api/schedule?from=2026-06-01&to=2026-09-30')
    if (!r.ok) throw new Error('Failed to load')
    return r.json()
  },
})
```

### Mutating data (TanStack Query)

```typescript
const mutation = useMutation({
  mutationFn: async (args) => {
    const r = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const json = await r.json()
    if (!r.ok) throw json
    return json
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['schedule'] })
    toast.success('Done!')
  },
  onError: (err) => toast.error(err.message || 'Failed'),
})
```

### Date handling

All dates are stored as ISO strings (`YYYY-MM-DDTHH:MM:SS.SSSZ`). Date comparisons use string comparison on the date portion (`YYYY-MM-DD`), which works correctly for chronological ordering. The `todayInBarbados()` function returns today's date in `America/Barbados` timezone using `Intl.DateTimeFormat`.
