# Architecture

This document describes the system design, data model, authentication flow, and deployment topology of RA Syncbot.

---

## High-Level Design

RA Syncbot is a single-page Next.js application served by Vercel. All state lives in Turso (libSQL/SQLite cloud). The browser never talks to Turso directly — every read/write goes through Next.js API routes that enforce auth and business rules.

```
┌─────────────────┐     HTTPS     ┌──────────────────┐     libSQL     ┌─────────┐
│  Browser (PWA)  │ ────────────► │  Next.js (Vercel)│ ─────────────► │  Turso  │
│  React 19 + DnD │ ◄──────────── │  API routes + SSR│ ◄───────────── │  (SQL)  │
└─────────────────┘                └──────────────────┘                 └─────────┘
                                          │
                                          │ fetch()
                                          ▼
                                   ┌──────────────┐
                                   │   Resend     │  (email notifications)
                                   └──────────────┘
```

There are no websockets, no background workers, and no message queues. Email notifications are fire-and-forget `fetch()` calls to Resend. Scheduled tasks (auto-archive, reminders) are triggered by Vercel Cron calling dedicated API endpoints.

---

## Application Layers

### 1. Presentation (`src/components/scheduler/`)
Pure React components. Each tab on the admin shell is its own component:
- `CalendarGrid` — week view, the drag-and-drop surface
- `CalendarView` — month view, read-only with clickable event chips
- `EventDetailDrawer` — right-side drawer for editing assignments on a specific day
- `RosterRail` — left-side list of instructors (draggable on desktop, tap-to-select on mobile)
- `EventsManagerTab`, `TeamTab`, `ConflictSummaryTab`, `WorkloadTab`, `InvitesTab`
- `InstructorView` — the instructor's 3-tab view (Assignments / Opt In / Calendar)
- `LoginForm`, `ClaimInviteForm` (with email verification step)
- `PrintLayout`, `PWAInstallPrompt`, `Accordion`, `HelpTooltip`

### 2. State management
- **Server state:** TanStack Query v5. Every list/detail fetch is a query; every mutation invalidates the relevant query keys.
- **Local UI state:** React `useState` only — no global store. The `selected` event, current week, active tab, and tap-selected instructor are all local to `page.tsx` and passed down via props.
- **No `useSyncExternalStore`** — it caused a TDZ crash that took a full session to diagnose. We use `useState + useEffect` for client-only state (claim token, mount detection).

### 3. API layer (`src/app/api/`)
Next.js App Router route handlers. Each route:
1. Reads the signed session cookie via `getAuthUser(req)` or `requireAdmin(req)`
2. Validates the request body
3. Executes SQL against Turso via `@libsql/client`
4. Returns JSON

All admin mutations are gated by `requireAdmin` which returns a 401/403 response if the caller is not an admin.

### 4. Data layer (`src/lib/`)
- **`db.ts`** — exports a single `db` client. Detects `TURSO_URL` in env; if present, connects to Turso, otherwise falls back to `file:./db/custom.db` for local dev.
- **`session.ts`** — HMAC-signed cookies using Web Crypto API (`crypto.subtle`). The cookie payload is `userId.hmac(userId)` so it can't be tampered with. Marked `server-only` to prevent leaking into client bundles.
- **`auth-helpers.ts`** — `getAuthUser`, `requireAdmin`, `requireAuth`. Wraps session reading + user lookup.
- **`conflicts.ts`** — pure functions: `checkAvailability`, `checkTemporalOverlap`, `checkSkillMatch`, `checkFatigue`, `getMissingSkills`. No I/O — used both client-side (instant feedback) and server-side (validation).
- **`email.ts`** — Resend API wrapper. `notifyAssignmentCreated`, `notifyAssignmentRemoved`, `notifyOptInReceived`, `sendReminders`. All silently no-op if `RESEND_API_KEY` is unset (dev mode).
- **`scheduler-types.ts`** — shared TypeScript types + date helpers (`todayInBarbados`, `isPastDate`, `eventOnDate`, `isEventPast`). All date math uses ISO strings (`YYYY-MM-DD`) and explicit UTC to avoid timezone drift.

---

## Data Model

Twelve tables. All UUIDs are v4 strings. Timestamps are ISO strings stored as `datetime('now')`. Run `bun run migrate` to add new tables/columns to an existing database.

### `User`
Authentication account. Either an admin or an instructor.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `name` | TEXT | Display name |
| `email` | TEXT UNIQUE | Login email; null until claimed |
| `role` | TEXT | `'admin'` or `'instructor'` |
| `passwordHash` | TEXT | bcrypt hash; null until claimed |
| `profileId` | TEXT FK → Profile | Links auth account to staff profile |
| `inviteToken` | TEXT UNIQUE | One-time token for the invite link |
| `claimedAt` | DATETIME | Null until the invite is claimed |
| `emailNotifications` | INTEGER | 1 (default) or 0 — per-user email toggle; bell always works |
| `createdAt`, `updatedAt` | DATETIME | |

### `Profile`
A staff member's professional record. One Profile can be linked to one User.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `name` | TEXT | |
| `sex` | TEXT NULL | |
| `role` | TEXT | e.g. "Lead Instructor" |
| `roleTier` | TEXT | `'lead'`, `'senior'`, `'junior'`, `'trainee'` |
| `skills` | TEXT | Comma-separated skill names |
| `available` | TEXT NULL | General availability notes |
| `unavailable` | TEXT NULL | Comma-separated ISO dates the instructor can't work |
| `contractSigned` | INTEGER | 0 or 1 |
| `notes` | TEXT NULL | |
| `createdAt`, `updatedAt` | DATETIME | |

### `Event`
A camp, workshop, or one-off session.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `code` | TEXT NULL | Short code e.g. `WSB-1` |
| `name` | TEXT | |
| `host` | TEXT | Partner organization |
| `hostColor` | TEXT | One of: `teal`, `emerald`, `pink`, `rose`, `amber`, `slate`, `sky` |
| `location` | TEXT NULL | |
| `description` | TEXT NULL | |
| `startDate`, `endDate` | TEXT | ISO `YYYY-MM-DD` |
| `startTime`, `endTime` | TEXT | `HH:MM` 24h |
| `status` | TEXT | `Draft`, `Tentative`, `Confirmed`, `Cancelled`, `Archived` |
| `specificDates` | TEXT NULL | Comma-separated ISO dates (overrides start/end if set) |
| `ageRange` | TEXT NULL | |
| `participantCount` | INTEGER NULL | |
| `requiredInstructors` | INTEGER | |
| `setupDate` | TEXT NULL | Optional setup day before the event |
| `setupTime` | TEXT NULL | |
| `notes` | TEXT NULL | |
| `createdAt`, `updatedAt` | DATETIME | |

### `Assignment`
A specific instructor assigned to a specific event on a specific date.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `eventId` | TEXT FK → Event | |
| `profileId` | TEXT FK → Profile | |
| `assignedDate` | TEXT | ISO `YYYY-MM-DD` |
| `status` | TEXT | `'primary'` or `'alternative'` |
| `isAlternative` | INTEGER | 0 or 1 (denormalized for fast filtering) |
| `shirtColor` | TEXT NULL | e.g. `Orange`, `Blue`, `Purple`, `Grey` |
| `ackStatus` | TEXT NULL | `'confirmed'`, `'declined'`, or null (pending) — set by instructor |
| `acknowledgedAt` | TEXT NULL | When the instructor acknowledged |
| `createdAt`, `updatedAt` | DATETIME | |

### `EventSkill`
Many-to-many join between events and skill names.

| Column | Type |
|---|---|
| `id` | TEXT (UUID) PK |
| `eventId` | TEXT FK → Event |
| `skillName` | TEXT |

### `OptIn`
An instructor's interest/availability declaration on an event (not a date — the whole event).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `userId` | TEXT FK → User | The instructor who opted in |
| `eventId` | TEXT FK → Event | |
| `status` | TEXT | `'interested'`, `'available'`, `'unavailable'` |
| `note` | TEXT NULL | |
| `createdAt`, `updatedAt` | DATETIME | |

### `Skill`
Reusable skill catalog. Define once, reuse across events and profiles.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `name` | TEXT UNIQUE | e.g. `Robotics`, `Python`, `Aerial Robotics` |
| `createdAt` | TEXT | |

Deleting a skill from the catalog does NOT cascade — existing `Profile.skills` (text) and `EventSkill.skillName` rows keep their values.

### `EquipmentCatalog`
Reusable equipment catalog (optional — admins can also type equipment names directly per event).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `name` | TEXT UNIQUE | e.g. `Drone (Tello EDU)` |
| `description` | TEXT NULL | |
| `createdAt` | TEXT | |

### `EventEquipment`
Equipment needed for a specific event. Created by admin in the event detail drawer.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `eventId` | TEXT FK → Event | CASCADE on delete |
| `name` | TEXT | e.g. `Drones`, `Laptops`, `Charger kit` |
| `quantity` | INTEGER | How many are needed |
| `notes` | TEXT NULL | |
| `createdAt`, `updatedAt` | TEXT | |

### `EquipmentClaim`
An instructor's claim to bring part or all of an equipment item. Has a unique index on `(equipmentItemId, profileId)` — one claim per instructor per item.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `equipmentItemId` | TEXT FK → EventEquipment | CASCADE on delete |
| `profileId` | TEXT FK → Profile | The instructor bringing it |
| `quantityClaimed` | INTEGER | How many they'll bring |
| `transportOffered` | INTEGER | 1 = can transport, 0 = needs dropoff |
| `notes` | TEXT NULL | e.g. "I'll pick them up from the office" |
| `createdAt`, `updatedAt` | TEXT | |

### `Notification`
In-app notification bell entries. Created by `notifyUser()` in `email.ts`.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `userId` | TEXT FK → User | CASCADE on delete |
| `type` | TEXT | `assignment_created`, `assignment_removed`, `opt_in_received`, `event_changed`, etc. |
| `title` | TEXT | Short headline |
| `body` | TEXT NULL | Longer description |
| `eventId` | TEXT NULL | Related event (makes notification clickable) |
| `assignmentId` | TEXT NULL | Related assignment |
| `readAt` | TEXT NULL | Null = unread |
| `createdAt` | TEXT | |

### `EmailQueue`
Pending digest emails. Rows are created by `notifyUser()` with `urgency = 'digest'` or `'instant'`. Instant emails are sent immediately and marked `sentAt`; digest emails are sent in the 8am digest or when admin clicks "Send now".

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `userId` | TEXT FK → User | CASCADE on delete |
| `type` | TEXT | Same as Notification.type |
| `subject` | TEXT | Email subject line |
| `body` | TEXT | HTML email body |
| `eventId` | TEXT NULL | |
| `urgency` | TEXT | `'instant'` or `'digest'` |
| `sentAt` | TEXT NULL | Null = pending; non-null = sent |
| `createdAt` | TEXT | |

---

## Authentication Flow

### Invite + claim flow
```
1. Admin creates an invite in the Invites tab
   → POST /api/invites creates a User row with role='instructor', inviteToken=UUID,
     claimedAt=null, profileId=<selected profile>
   → Admin sends the invite link: https://ra-syncbot.com/?token=<inviteToken>

2. Instructor opens the link
   → Client reads ?token= from URL
   → POST /api/auth/claim with { token, name, email, password }
   → Server validates token + email uniqueness
   → Server generates 6-digit code, stores in memory (10-min expiry)
   → Server emails code via Resend
   → Server returns { step: 'verify' }

3. Instructor enters the 6-digit code
   → POST /api/auth/claim with { token, name, email, password, verifyCode }
   → Server validates code
   → Server hashes password with bcrypt
   → Server UPDATEs User: claimedAt=now, passwordHash=hash, email=email, name=name
   → Server emails welcome message
   → Server sets signed session cookie
   → Server returns { user: {...} }

4. Subsequent requests
   → Browser sends cookie `ra-session=userId.hmac`
   → Server reads cookie, verifies HMAC, looks up User
   → If !claimedAt → 401
```

### Login flow (already-claimed instructors)
```
1. POST /api/auth/me with { email, password }
2. Server looks up User by email
3. Server compares bcrypt hash
4. If match → set signed cookie, return { user: {...} }
5. If no match → 401 { error: 'Invalid email or password' }
```

### Security properties
- Passwords are bcrypt-hashed (10 rounds) — never stored in plaintext.
- Session cookies are HMAC-signed with `SESSION_PASSWORD` (Web Crypto API).
- Cookies are `httpOnly`, `sameSite=lax`, `secure` in production.
- The HMAC secret must be ≥32 characters; rotate by changing `SESSION_PASSWORD` (invalidates all sessions).
- All admin routes call `requireAdmin(req)` which returns 401/403 early.
- The `/api/seed` endpoint is **disabled in production** (returns 403) to prevent accidental data wipes.

---

## Drag-and-Drop Design

### Desktop
- `@dnd-kit/core` with `PointerSensor` (8px activation distance).
- The `RosterRail` renders each instructor as a `DraggableInstructor`.
- Each `DroppableEventCard` registers a per-day drop target (`drop-${eventId}-${date}`).
- Multi-day events expose a second "all days" target on the first day of the current week.
- `DragOverlay` renders a rotated preview of the dragged instructor card.
- On drop, `POST /api/assignments` creates the assignment after server-side conflict validation.

### Mobile
- `useIsMobile()` returns `true` when viewport width < 768px.
- On mobile, `PointerSensor` activation distance is set to 9999 (effectively disabled).
- Instead, tapping an instructor in the roster selects them (visual highlight + floating bottom bar).
- Tapping an event card calls the same `POST /api/assignments` mutation.
- This avoids the broken mobile drag-drop experience that plagued earlier versions.

---

## Conflict Detection

Conflicts are computed by pure functions in `src/lib/conflicts.ts`. They run in two places:

1. **Client-side** (instant feedback) — before dropping, the UI calls the functions and shows a toast warning if any conflict is detected.
2. **Server-side** (validation) — the `POST /api/assignments` route re-runs the checks and returns 409 with details if any hard conflict exists.

### Conflict types
| Conflict | Behavior |
|---|---|
| Double-booking | **Blocked** — instructor already assigned to another event on the same date |
| Unavailable date | **Blocked** — instructor marked the date as unavailable |
| Temporal overlap | **Blocked** — instructor's events on the same date have overlapping times |
| Fatigue (3+ consecutive days) | **Warning** — allowed but flagged in the Conflicts tab |
| Skill gap | **Informational** — instructor lacks a required skill; admin can still assign |

Soft conflicts (fatigue, skill gaps) are surfaced in the `ConflictSummaryTab` and as inline warnings on the calendar.

---

## Email + Notification System

All email is sent via Resend's REST API (`fetch()`, no SDK). The `sendEmail()` helper in `src/lib/email.ts` silently no-ops if `RESEND_API_KEY` is unset, so dev environments without email still work. All user-supplied values are HTML-escaped via `escapeHtml()` before interpolation into email bodies.

### Smart digest system

Notifications have two urgency levels:

| Urgency | When | Behavior |
|---|---|---|
| `instant` | Event is within 72 hours, OR opt-in receipt, OR verification code | Email sent immediately + in-app notification created |
| `digest` | Event is >72 hours away | In-app notification created immediately; email queued for 8am AST digest |

This prevents email spam when the admin iterates on assignments during planning sessions. The admin can flush the digest queue at any time via the "Send now" button (paper airplane icon in the top bar) — `POST /api/notifications/send-now`.

### Per-user email toggle

Each user has `emailNotifications` (default 1 = on). Instructors can toggle this via the mail icon in their top bar. When off:
- ✅ In-app bell notifications still work (always on)
- ❌ No emails sent (digest queue rows are still created but `sendDigests`/`sendAllPending` skip users with the toggle off)
- ✅ Verification codes + welcome emails bypass the toggle (transactional)

### Notification bell

Both admins and instructors see a bell icon in the top bar. The `NotificationBell` component polls `/api/notifications` every 30 seconds. Unread count shows as a red badge. Click a notification to mark it read; "Mark all read" button clears all.

### Triggered notifications
| Event | Recipient | Urgency | Type |
|---|---|---|---|
| Assignment created | Instructor | instant (if <72h) / digest (if >72h) | `assignment_created` |
| Assignment removed | Instructor | instant (if <72h) / digest (if >72h) | `assignment_removed` |
| Opt-in received | All admins | instant | `opt_in_received` |
| Daily reminder (cron) | Each instructor with assignment in 2 days | instant (direct send, not queued) | `reminder` |
| Verification code (claim flow) | Claiming instructor | instant (bypasses toggle) | n/a (direct send) |
| Welcome (post-claim) | New instructor | instant (bypasses toggle) | n/a (direct send) |

### Vercel Cron
Two endpoints are intended to be hit by Vercel Cron:
- `POST /api/reminders` — sends 2-day reminders AND flushes the daily digest
- `POST /api/auto-archive` — moves past events to `Archived` status

Configure these in `vercel.json` (not currently set — add when going to production).

---

## Equipment + Skill Catalog

### Skill catalog
- `Skill` table stores reusable skill names (define once, reuse everywhere)
- `SkillPicker` component replaces free-text inputs in Events + Team tabs
- Admins can manage the catalog (add/delete) from inside the picker via the "Manage catalog" link
- Deleting a skill does NOT cascade — existing `Profile.skills` (text) and `EventSkill.skillName` rows keep their values

### Equipment coordination
- Admin adds equipment items per event via the `EquipmentSection` in the event detail drawer (admin mode)
- Each item has: name, quantity needed, optional notes
- Instructors claim items they'll bring: "I'll bring" button with quantity + "I can transport" checkbox
- Server-side validation: can't claim more than available (needed minus other instructors' claims)
- Unique index on `(equipmentItemId, profileId)` prevents duplicate claims
- Admin sees claims with truck icon (transport offered) per item
- The instructor event drawer shows the equipment section only if the instructor is assigned to the event
- Release a claim with the X button

### Acknowledgment system
- Instructors see ✓ (confirm) / ✗ (decline) buttons on each assignment in the My Assignments tab
- `PATCH /api/assignments?id=<id>` with `{ ackStatus: 'confirmed' | 'declined' }` — instructors can only ack their own assignments
- Admin sees per-assignment ack status (✓ or ✗ declined) in the EventDetailDrawer
- Admin sees a summary: "X confirmed, Y declined, Z pending"
- Confirmed assignments get a green border; declined get a red border

---

## Deployment Topology

```
┌──────────────────────────────────────────────────────────┐
│  Vercel (Next.js, free tier)                             │
│  ├── Static assets served from CDN                       │
│  ├── API routes run as serverless functions (30s limit)  │
│  └── Custom domain: ra-syncbot.com                       │
└──────────────────────────────────────────────────────────┘
              │                          │
              ▼                          ▼
   ┌──────────────────┐       ┌──────────────────┐
   │  Turso (free)    │       │  Resend (free)   │
   │  Single DB       │       │  100 emails/day  │
   │  libSQL protocol │       │  REST API        │
   └──────────────────┘       └──────────────────┘
```

### Environment variables (production)
| Variable | Purpose |
|---|---|
| `TURSO_URL` | libsql:// connection string |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `SESSION_PASSWORD` | ≥32-char secret for HMAC cookie signing |
| `RESEND_API_KEY` | Resend API key (optional — skips email if unset) |
| `FROM_EMAIL` | Sender address (must be a verified Resend domain) |
| `ADMIN_EMAIL` | Receives opt-in notifications |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step setup.

---

## Known Constraints

- **30-second function timeout** on Vercel free tier. Long reports or bulk operations must stay under this.
- **Turso free tier** allows 9 GB storage and 1 billion row reads/month — far beyond what RA Syncbot needs.
- **Resend free tier** is 100 emails/day, 3,000/month. Daily reminders + assignment notifications should stay well under this for ~20 instructors.
- **In-memory verification codes** — the claim-flow verification codes are stored in a `Map` in the API route module. This resets on every cold start. For a more robust system, move these to a `VerificationCode` table with expiry.
- **No offline mode** — the app requires network to load schedule data. PWA installability is for the home-screen icon, not offline use.

---

## Design Decisions

### Why raw SQL instead of an ORM?
Prisma's libSQL driver adapter had runtime issues on Vercel during initial development (mismatched binary deps, cold-start crashes). Raw SQL via `@libsql/client` is simpler, has zero cold-start overhead, and the queries are all straightforward CRUD. The trade-off is no type-safe schema — we compensate with the shared types in `scheduler-types.ts`.

### Why HMAC cookies instead of JWT?
JWTs encode claims client-side, which means we'd need to handle expiry, refresh, and revocation. HMAC cookies are opaque to the client; the server looks up the user on every request. Simpler, safer for this use case, and the lookup cost is negligible against Turso's edge replicas.

### Why Web Crypto instead of Node's `crypto`?
Node's `crypto` module (`createHmac`) leaked into the client bundle during initial development and caused a TDZ crash on desktop (`Cannot access 'g' before initialization`). Web Crypto (`crypto.subtle`) is isomorphic — it works in both Node 18+ and the browser — and never leaks into client bundles because it's only ever called from `server-only` modules.

### Why `useState + useEffect` instead of `useSyncExternalStore`?
`useSyncExternalStore` was used to read the invite token from the URL without hydration mismatch. It triggered the same TDZ crash as `crypto` — likely a React 19 + Turbopack interaction. We reverted to `useState` initialized to `null` plus a `useEffect` that reads `window.location.search`. This causes one extra render but is rock-solid.
