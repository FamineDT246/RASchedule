# API Reference

All endpoints are under `/api/`. Authentication uses an httpOnly cookie named `ra-user-id`.

**Auth required** = any authenticated user (admin or instructor)
**Admin only** = requires `role: 'admin'`

---

## Authentication

### POST `/api/auth/me`
Login with email + password. Sets `ra-user-id` cookie.

| | |
|---|---|
| Auth | None |
| Body | `{ email: string, password: string }` |
| Success | `200 { user: { id, name, email, role, profileId, profile } }` |
| Error | `401 { error: "Invalid email or password" }` |

### GET `/api/auth/me`
Returns the currently logged-in user.

| | |
|---|---|
| Auth | None |
| Success | `200 { user: { ... } }` or `200 { user: null }` |

### POST `/api/auth/claim`
Claim an invite token. Sets `ra-user-id` cookie.

| | |
|---|---|
| Auth | None |
| Body | `{ token: string, email: string, password: string, name?: string }` |
| Success | `200 { user: { id, name, email, role, profileId } }` |
| Error | `400/404/410/409 { error: string }` |

### POST `/api/auth/logout`
Clears the auth cookie.

| | |
|---|---|
| Auth | None |
| Success | `200 { ok: true }` |

### POST `/api/auth/change-password`
Change the current user's password.

| | |
|---|---|
| Auth | Required |
| Body | `{ currentPassword: string, newPassword: string }` |
| Success | `200 { ok: true }` |
| Error | `400/401 { error: string }` |

---

## Schedule

### GET `/api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD&includeDrafts=0`
Returns all profiles, events (non-Draft by default), assignments, and opt-ins in the date range.

| | |
|---|---|
| Auth | None |
| Query | `from`, `to` (ISO dates), `includeDrafts` (0 or 1) |
| Success | `200 { profiles: [], events: [], assignments: [] }` |

---

## Events

### GET `/api/events`
Returns all events with assignment counts and opt-in counts.

| | |
|---|---|
| Auth | None |
| Success | `200 [ { ...event, requiredSkills: [], _assignmentCount, _optInCount } ]` |

### POST `/api/events`
Create a new event.

| | |
|---|---|
| Auth | Admin only |
| Body | `{ name, host, hostColor, location, description, startDate, endDate, startTime, endTime, status, specificDates, ageRange, participantCount, requiredInstructors, notes, skills }` |
| Success | `201 { ...event }` |

### PUT `/api/events?id=...`
Update an event.

| | |
|---|---|
| Auth | Admin only |
| Body | Same as POST (partial) |
| Success | `200 { ...event }` |

### DELETE `/api/events?id=...`
Delete an event (cascades to EventSkill, Assignment, OptIn).

| | |
|---|---|
| Auth | Admin only |
| Success | `200 { ok: true }` |

---

## Profiles (Staff)

### GET `/api/profiles`
Returns all staff profiles.

| | |
|---|---|
| Auth | None |
| Success | `200 [ { ...profile, skillsList: [], unavailableList: [] } ]` |

### GET `/api/profiles/me`
Returns the current user's linked profile.

| | |
|---|---|
| Auth | Required |
| Success | `200 { ...profile, skillsList: [], unavailableList: [] }` |

### POST `/api/profiles`
Create a staff profile.

| | |
|---|---|
| Auth | Admin only |
| Body | `{ name, role, roleTier, skills, available, unavailable, contractSigned, notes, sex }` |
| Success | `201 { ...profile }` |

### PUT `/api/profiles?id=...`
Update a staff profile.

| | |
|---|---|
| Auth | Admin only |
| Body | Same as POST (partial) |
| Success | `200 { ...profile }` |

### DELETE `/api/profiles?id=...`
Delete a staff profile (cascades to Assignment, User).

| | |
|---|---|
| Auth | Admin only |
| Success | `200 { ok: true }` |

---

## Assignments

### GET `/api/assignments?eventId=...&profileId=...&date=YYYY-MM-DD`
Returns assignments, optionally filtered.

| | |
|---|---|
| Auth | None |
| Success | `200 [ { ...assignment } ]` |

### POST `/api/assignments`
Create a single-day assignment.

| | |
|---|---|
| Auth | Admin only |
| Body | `{ eventId, profileId, date, isAlternative?, shirtColor? }` |
| Success | `201 { ...assignment }` |
| Error | `400 { error: "Cannot assign to a past date..." }` |

### POST `/api/assignments/bulk`
Assign an instructor to ALL days of an event.

| | |
|---|---|
| Auth | Admin only |
| Body | `{ eventId, profileId }` |
| Success | `200 { created, existing, conflicts, skippedPast }` |

### PATCH `/api/assignments?id=...`
Update an assignment (shirt color, alternative flag, status).

| | |
|---|---|
| Auth | Admin only |
| Body | `{ isAlternative?, shirtColor?, status? }` |
| Success | `200 { ...assignment }` |

### DELETE `/api/assignments?id=...`
Remove an assignment.

| | |
|---|---|
| Auth | Admin only |
| Success | `200 { ok: true }` |

---

## Invites

### GET `/api/invites`
Returns all invite tokens.

| | |
|---|---|
| Auth | Admin only |
| Success | `200 [ { id, name, email, role, profileId, profileName, inviteToken, claimedAt, inviteExpiresAt, createdAt } ]` |

### POST `/api/invites`
Create an invite for an existing staff member.

| | |
|---|---|
| Auth | Admin only |
| Body | `{ name: string, profileId?: string }` |
| Success | `201 { id, name, inviteToken, profileId }` |

### DELETE `/api/invites?id=...`
Revoke an invite (deletes the user account).

| | |
|---|---|
| Auth | Admin only |
| Success | `200 { ok: true }` |

---

## Opt-ins

### GET `/api/opt-ins?eventId=...`
Returns opt-ins. Instructors only see their own. Admins see all.

| | |
|---|---|
| Auth | Required |
| Success | `200 [ { id, userId, userName, eventId, eventName, status, note } ]` |

### POST `/api/opt-ins`
Upsert an opt-in for the current user.

| | |
|---|---|
| Auth | Instructor only |
| Body | `{ eventId: string, status: 'interested' | 'available' | 'unavailable', note?: string }` |
| Success | `201 { ...optIn }` |

---

## Utility

### POST `/api/auto-archive`
Automatically archives events whose end date has passed. Called automatically when the schedule loads.

| | |
|---|---|
| Auth | None |
| Success | `200 { archived: number }` |

### POST `/api/seed`
**DISABLED in production.** Returns 403.

| | |
|---|---|
| Auth | None |
| Response | `403 { error: "Seed endpoint is disabled in production" }` |
