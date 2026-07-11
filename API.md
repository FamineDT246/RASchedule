# API Reference

All routes are under `/api`. Request bodies are JSON. Responses are JSON. All mutations require authentication via the `ra-session` cookie.

## Authentication

| Header / Cookie | Required | Description |
|---|---|---|
| `Cookie: ra-session=<userId>.<hmac>` | Yes (for protected routes) | Set by `/api/auth/me` or `/api/auth/claim` |

### Auth helper responses
- `401 Unauthorized` — no session, or user not found
- `403 Forbidden` — authenticated but not admin (admin routes only)

---

## Auth

### `POST /api/auth/me`
Login or refresh the current session.

**Request body**
```json
{ "email": "user@example.com", "password": "secret123" }
```
**200 Response**
```json
{
  "user": {
    "id": "uuid",
    "name": "Jamie Smith",
    "email": "user@example.com",
    "role": "admin",
    "profileId": "uuid" | null,
    "emailNotifications": true,
    "profile": { "id": "uuid", "name": "...", "roleTier": "lead", "role": "...", "skills": "...", "unavailable": "..." } | null
  }
}
```
**401 Response** — `{ "error": "Invalid email or password" }`

Sets `ra-session` cookie (httpOnly, 30-day expiry).

---

### `GET /api/auth/me`
Return the currently authenticated user. Useful for refreshing on page load.

**200 Response** — same shape as the POST response, or `{ "user": null }` if not authenticated.

---

### `POST /api/auth/claim`
Claim an invite. Two-step flow with email verification.

**Step 1 — request verification code**
```json
{ "token": "<inviteToken>", "name": "Jamie Smith", "email": "jamie@example.com", "password": "secret123" }
```
**200 Response** — `{ "step": "verify", "message": "Verification code sent to your email." }`

**Step 2 — verify code and claim**
```json
{ "token": "<inviteToken>", "name": "Jamie Smith", "email": "jamie@example.com", "password": "secret123", "verifyCode": "123456" }
```
**200 Response** — `{ "user": { ... } }` (same shape as login) and sets the session cookie.

**Error responses**
- `400` — missing token, email, or password too short (<6 chars)
- `404` — invalid invite token
- `409` — email already in use
- `410` — invite link expired or verification code expired
- `401` — incorrect verification code

> **Note:** If `RESEND_API_KEY` is not set, the server skips email verification and claims the account immediately (dev mode).

---

### `POST /api/auth/logout`
Clear the session cookie. No request body.

**200 Response** — `{ "ok": true }`

---

### `POST /api/auth/change-password`
Change the current user's password. Requires authentication.

**Request body**
```json
{ "currentPassword": "old", "newPassword": "newpass123" }
```
**200 Response** — `{ "ok": true }`
**401 Response** — `{ "error": "Current password is incorrect" }`

---

### `POST /api/auth/update-email-prefs`
Toggle email notifications for the current user. The notification bell is always on regardless of this setting.

**Request body** — `{ "emailNotifications": true }`

**200 Response** — `{ "ok": true, "emailNotifications": true }`

---

## Schedule

### `GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD`
Fetch all profiles, events, and assignments in the date range. This is the primary data fetch for the admin scheduler.

**Query params**
- `from` (optional, default `2026-06-01`) — ISO date
- `to` (optional, default `2026-09-30`) — ISO date
- `includeDrafts=1` (optional) — include Draft events (admin only)

**200 Response**
```json
{
  "profiles": [ ProfileView ],
  "events":    [ EventView ],
  "assignments": [ AssignmentView ]
}
```

See `src/lib/scheduler-types.ts` for the full type definitions.

**Filtering rules**
- Events: excludes `Draft` by default; includes `Confirmed`, `Tentative`, `Cancelled`, `Archived`
- Assignments: all assignments with `assignedDate` between `from` and `to`
- Profiles: all profiles (admin sees everyone; instructors should use `/api/profiles/me`)

---

## Assignments

### `GET /api/assignments?eventId=<id>&date=YYYY-MM-DD`
Fetch assignments for a specific event+date. Used by the event detail drawer.

**200 Response** — `{ "assignments": [ AssignmentView ] }`

---

### `POST /api/assignments`
Create a new assignment. **Admin only.** Runs server-side conflict validation.

**Request body**
```json
{
  "eventId": "uuid",
  "profileId": "uuid",
  "date": "2026-07-15",
  "isAlternative": false,
  "shirtColor": "Orange"
}
```
**200 Response** — `{ "assignment": AssignmentView }`
**409 Response** — `{ "error": "Conflict: ...", "conflicts": [...] }`

Triggers `notifyAssignmentCreated` email (instant if event <72h, digest otherwise).

---

### `POST /api/assignments/bulk`
Create the same assignment across multiple dates. **Admin only.**

**Request body**
```json
{
  "eventId": "uuid",
  "profileId": "uuid",
  "dates": ["2026-07-06", "2026-07-07", "2026-07-08"],
  "isAlternative": false
}
```
**200 Response** — `{ "created": 3, "skipped": 0 }`

---

### `PATCH /api/assignments?id=<id>`
Update an existing assignment. Two modes:

**Instructor mode** — acknowledge an assignment (instructors can only ack their own):
```json
{ "ackStatus": "confirmed" }
```
or `{ "ackStatus": "declined" }`

**Admin mode** — update assignment fields:
```json
{ "shirtColor": "Blue", "isAlternative": false }
```

**200 Response** — `{ "assignment": AssignmentView }`

---

### `DELETE /api/assignments?id=<id>`
Remove an assignment. **Admin only.**

**200 Response** — `{ "ok": true }`

Triggers `notifyAssignmentRemoved` email (instant if event <72h, digest otherwise).

---

## Events

### `GET /api/events`
List all events. **Admin only.**

**200 Response** — `[ EventView ]`

---

### `POST /api/events`
Create a new event. **Admin only.**

**Request body**
```json
{
  "code": "WSB-1",
  "name": "Aerial Robotics",
  "host": "TVETC / WSB",
  "hostColor": "teal",
  "location": "SJPI",
  "description": "...",
  "startDate": "2026-07-06",
  "endDate": "2026-07-10",
  "startTime": "09:00",
  "endTime": "15:00",
  "status": "Confirmed",
  "specificDates": null,
  "ageRange": "10-16",
  "participantCount": 25,
  "requiredInstructors": 5,
  "setupDate": null,
  "setupTime": null,
  "notes": "",
  "skills": ["Aerial Robotics", "Python"]
}
```
**200 Response** — `{ "event": EventView }`

---

### `PUT /api/events?id=<id>`
Update an event. **Admin only.** Accepts the same body as POST (all fields optional).

**200 Response** — `{ "event": EventView }`

---

### `DELETE /api/events?id=<id>`
Delete an event. **Admin only.** Also deletes all child assignments and EventSkill rows.

**200 Response** — `{ "ok": true }`

---

## Profiles

### `GET /api/profiles`
List all staff profiles. **Admin only.**

**200 Response** — `[ ProfileView ]`

---

### `GET /api/profiles/me`
Get the current instructor's own profile. Used by the instructor view.

**200 Response** — `ProfileView` or `{ "error": "No profile linked" }` (404)

---

### `POST /api/profiles`
Create a new staff profile. **Admin only.**

**Request body**
```json
{
  "name": "Jamie Smith",
  "sex": "F",
  "role": "Lead Instructor",
  "roleTier": "lead",
  "skills": "Robotics,Python",
  "available": null,
  "unavailable": null,
  "contractSigned": true,
  "notes": ""
}
```
**200 Response** — `{ "profile": ProfileView }`

---

### `PUT /api/profiles?id=<id>`
Update a profile. **Admin only** (or the linked instructor updating their own unavailable dates).

**Request body** — partial Profile fields. Common use case:
```json
{ "unavailable": "2026-07-15,2026-07-22" }
```
**200 Response** — `{ "profile": ProfileView }`

---

### `DELETE /api/profiles?id=<id>`
Delete a profile. **Admin only.**

**200 Response** — `{ "ok": true }`

---

## Opt-Ins

### `GET /api/opt-ins`
List the current instructor's opt-ins. **Authenticated.**

**200 Response** — `[ OptInView ]`

---

### `POST /api/opt-ins`
Create or update an opt-in. **Authenticated (instructors only).**

**Request body**
```json
{ "eventId": "uuid", "status": "interested", "note": "I love drones!" }
```
`status` must be one of: `interested`, `available`, `unavailable`.

**200 Response** — `{ "optIn": OptInView }`

Triggers `notifyOptInReceived` email to all admins (always instant).

---

## Invites

### `GET /api/invites`
List all invites. **Admin only.**

**200 Response** — `{ "invites": [ InviteView ] }`

---

### `POST /api/invites`
Create a new invite. **Admin only.**

**Request body**
```json
{ "name": "Jamie Smith", "role": "instructor", "profileId": "uuid" }
```
**200 Response** — `{ "invite": InviteView }` (includes `inviteToken` and a ready-to-share URL)

---

### `DELETE /api/invites?id=<id>`
Revoke an invite. **Admin only.** Only works on unclaimed invites.

**200 Response** — `{ "ok": true }`

---

## Notifications

### `GET /api/notifications`
Return the current user's notifications (from the `Notification` table).

**200 Response**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "assignment_created",
      "title": "New assignment: ...",
      "body": "...",
      "eventId": "uuid",
      "assignmentId": "uuid",
      "readAt": null,
      "createdAt": "2026-07-11T...",
      "read": false
    }
  ],
  "unread": 3
}
```

### `POST /api/notifications/read?id=<notificationId>`
Mark a single notification as read. If `id` is omitted, marks ALL of the user's notifications as read.

**200 Response** — `{ "ok": true }`

### `POST /api/notifications/send-now`
**Admin only.** Flush all pending digest emails immediately. Useful when the admin has finished iterating on assignments and wants to notify instructors right away instead of waiting for the 8am digest.

**200 Response** — `{ "sent": N, "skipped": boolean }`

---

## Skills (catalog)

### `GET /api/skills`
List all skills in the catalog. **Authenticated.**

**200 Response** — `[ { "id": "uuid", "name": "Robotics", "createdAt": "..." } ]`

### `POST /api/skills`
Create a new skill in the catalog. **Admin only.**

**Request body** — `{ "name": "Drone Piloting" }`

**201 Response** — `{ "id": "uuid", "name": "Drone Piloting" }`

### `DELETE /api/skills?id=<id>`
Remove a skill from the catalog. **Admin only.** Does not affect existing assignments (skills are stored as text on Profile.skills and EventSkill.skillName).

**200 Response** — `{ "ok": true }`

---

## Equipment catalog

### `GET /api/equipment`
List all equipment catalog items. **Authenticated.**

**200 Response** — `[ { "id": "uuid", "name": "Drone (Tello EDU)", "description": "..." } ]`

### `POST /api/equipment`
Create a new equipment catalog item. **Admin only.**

**Request body** — `{ "name": "Drone (Tello EDU)", "description": "Educational drone" }`

### `DELETE /api/equipment?id=<id>`
Remove from catalog. **Admin only.**

---

## Event equipment (per-event)

### `GET /api/event-equipment?eventId=<id>`
List equipment items + their claims for a specific event.

**200 Response**
```json
[
  {
    "id": "uuid",
    "eventId": "uuid",
    "name": "Drones",
    "quantity": 5,
    "notes": null,
    "claims": [
      {
        "id": "uuid",
        "equipmentItemId": "uuid",
        "profileId": "uuid",
        "profileName": "Nathan Reid",
        "quantityClaimed": 3,
        "transportOffered": true,
        "notes": null,
        "createdAt": "..."
      }
    ]
  }
]
```

### `POST /api/event-equipment`
Add an equipment item to an event. **Admin only.**

**Request body** — `{ "eventId": "uuid", "name": "Drones", "quantity": 5, "notes": "Tello EDU" }`

### `PATCH /api/event-equipment?id=<itemId>`
Update quantity/notes. **Admin only.**

### `DELETE /api/event-equipment?id=<itemId>`
Remove an equipment item (cascades to its claims). **Admin only.**

---

## Equipment claims (instructor transport)

### `GET /api/equipment-claims?equipmentItemId=<id>`
List claims for an equipment item.

### `POST /api/equipment-claims`
Create or update a claim. Instructors say "I'll bring this" and optionally mark that they can transport it.

**Request body**
```json
{
  "equipmentItemId": "uuid",
  "quantityClaimed": 2,
  "transportOffered": true,
  "notes": "I'll pick them up from the office"
}
```

Server-side validation: can't claim more than available (needed minus other instructors' claims). If the instructor already has a claim on this item, the existing claim is updated.

### `DELETE /api/equipment-claims?id=<claimId>`
Release a claim. Instructors can only release their own claims; admins can release any.

---

## iCal

### `GET /api/ical?token=<userId>`
Return an iCal calendar feed of the instructor's assignments. No session cookie required — the `token` (userId) acts as the auth.

**200 Response** — `Content-Type: text/calendar`
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RA Syncbot//Instructor Calendar//EN
BEGIN:VEVENT
UID:assignment-uuid@ra-syncbot.com
DTSTART:20260706T090000Z
DTEND:20260706T150000Z
SUMMARY:WSB — Aerial Robotics
LOCATION:SJPI
END:VEVENT
...
END:VCALENDAR
```

Instructors subscribe via their account menu → "Subscribe to calendar".

---

## Cron endpoints

These are intended to be called by Vercel Cron (or any external scheduler).

### `POST /api/reminders`
Send reminder emails for assignments happening in 2 days, AND send the daily digest of pending notifications.

**200 Response** — `{ "reminders": N, "digests": N, "skipped": boolean }`

### `POST /api/auto-archive`
Move all events whose `endDate` is in the past to `Archived` status.

**200 Response** — `{ "archived": N }`

---

## Seed (disabled in production)

### `POST /api/seed`
Wipe and reseed the database. **Returns 403 in production.** In development, requires the `SESSION_PASSWORD` env var to match the request body.

**Request body** — `{ "confirm": "WIPE" }`

**200 Response (dev only)** — `{ "ok": true, "seeded": { "profiles": 20, "events": 17, "assignments": 33 } }`

> ⚠️ This endpoint is intentionally dangerous. Never enable it in production.
