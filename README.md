# RA Syncbot

**Drag-and-drop camp & workshop instructor scheduling for RA Syncbot Ltd (Barbados).**

RA Syncbot replaces a chaotic spreadsheet-based system for managing ~20 instructors across 15+ summer camps and workshops. Admins drag instructors onto events; instructors log in to view their schedule, opt in to events, and sync their personal calendar.

- **Live site:** [ra-syncbot.com](https://www.ra-syncbot.com)
- **Platform:** Vercel + Turso + Resend
- **Stack:** Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui (pruned), @dnd-kit, TanStack Query

---

## Features

### Admin
- **Drag-and-drop scheduler** — drag instructors from the roster rail onto any event/day; supports multi-day "drop on all days" handle.
- **Mobile tap-to-assign** — same workflow on phones via tap-to-select-then-tap-event.
- **Week + month calendar views** — week view for editing, month view for overview.
- **Conflict detection** — double-bookings, fatigue (3+ consecutive days), skill gaps, and unavailable-date violations are flagged in real time.
- **Event management** — create, edit, delete, and archive events; set required skills, host, location, age range, participant count, setup date/time, and shirt colors.
- **Equipment coordination** — post equipment lists per event; instructors claim items they'll bring; transport matchmaking.
- **Team management** — manage instructor profiles, skills, contracts, and notes.
- **Skill catalog** — reusable skill catalog (define once, reuse everywhere); add/delete from the picker.
- **Invites** — generate invite links for new instructors; revoke or resend at any time.
- **Workload dashboard** — per-instructor assignment counts, day breakdowns, opt-in summary.
- **Conflict summary tab** — overview of every flagged conflict across all events.
- **Acknowledgment tracking** — see which instructors confirmed vs. declined their assignments.
- **Print & PDF export** — print the current week or export a PDF.
- **CSV export** — bulk export all assignments.
- **Send-now button** — flush pending digest emails immediately instead of waiting for the 8am digest.

### Instructor
- **3-tab view** — My Assignments / Opt In / Calendar.
- **Acknowledge button** — confirm or decline each assignment; admin sees your response.
- **Notification bell** — in-app bell with unread badge; no need to check email.
- **Email toggle** — turn email notifications on/off per account (bell always works).
- **Opt-in system** — express interest (interested / available / unavailable) on any event.
- **Equipment claims** — claim items you'll bring; mark if you can transport; the boss arranges dropoff.
- **Availability management** — mark dates you can't work; the admin scheduler respects these.
- **Calendar sync** — subscribe to a personal iCal feed (`/api/ical?token=<userId>`).
- **Email notifications** — smart digest system: instant for urgent changes (<72h), daily digest otherwise.
- **Account claim flow** — invite links require email verification (6-digit code) before account creation.

### Cross-cutting
- **Smart email digest** — changes to events >72h away queue for the 8am digest; changes to events <72h away fire instantly; opt-in receipts always instant; admin can flush the queue manually.
- **Light/dark mode** toggle with system preference default.
- **PWA installable** — add to home screen on iOS/Android.
- **WCAG 2.1 AA** — 16px base text, 12px floor, 44px touch targets, ARIA roles, full keyboard navigation.
- **Esc-to-close** — drawers, modals, and tap selections all close on Esc.
- **Auto-archive** — past events are auto-archived via a cron-style API endpoint.
- **Past-date protection** — past dates are visually dimmed and drop-disabled at the API level.
- **Barbados timezone** — all date comparisons use America/Barbados (AST, UTC-4).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + `tw-animate-css` |
| UI primitives | shadcn/ui (pruned to 10 components) + Radix |
| Drag-and-drop | `@dnd-kit/core` |
| Server state | TanStack Query v5 |
| Auth | bcryptjs + signed HMAC cookies (Web Crypto API) |
| Database | Turso (libSQL/SQLite cloud) via `@libsql/client` |
| Email | Resend (via `fetch()`, no SDK) |
| Hosting | Vercel (free tier) |
| Calendar sync | iCal feed (`/api/ical`) |
| PWA | `manifest.json` + icons |

---

## Quick Start

### Prerequisites
- Node.js 18+ or Bun
- A Turso database (free tier works)
- (Optional) A Resend account for email notifications

### Install & run locally

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and fill in your values
cp .env.example .env
# Edit .env — at minimum set TURSO_URL and TURSO_AUTH_TOKEN

# 3. Run the database seed (creates schema + demo data)
bun run seed

# 3b. (Existing deployments only) Run migrations to add new tables/columns
bun run migrate

# 4. Start the dev server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the admin credentials created by the seed script.

### Default admin (from seed)
- Email: `robotadventuresltd@gmail.com`
- Password: `admin123`

> ⚠️ **Change this password immediately** in production via the account menu → Change password.

---

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── api/                  # API routes (see API.md)
│   │   ├── globals.css           # Tailwind + WCAG typography rules
│   │   ├── layout.tsx            # Root layout, fonts, theme provider
│   │   ├── page.tsx              # Main app — auth gate, tabs, drag-and-drop
│   │   └── providers.tsx         # TanStack Query + theme + Sonner toaster
│   ├── components/
│   │   ├── scheduler/            # App-specific components (20 files)
│   │   └── ui/                   # Pruned shadcn/ui (10 components)
│   ├── hooks/
│   │   └── use-is-mobile.ts      # Mobile detection (breakpoint-based)
│   └── lib/
│       ├── auth-helpers.ts       # requireAdmin / requireAuth / getAuthUser
│       ├── conflicts.ts          # Pure conflict-detection functions
│       ├── db.ts                 # Turso client (auto-fallback to local SQLite)
│       ├── email.ts              # Resend API wrapper
│       ├── export-utils.ts       # CSV export helper
│       ├── scheduler-types.ts    # Shared types + date helpers
│       ├── session.ts            # HMAC-signed cookies (Web Crypto)
│       └── utils.ts              # cn() classname merger
├── public/                       # logo, icons, manifest, robots.txt
├── scripts/
│   └── seed.ts                   # Database seed (run with `bun run seed`)
├── .env.example
├── next.config.ts
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json
```

---

## Documentation

| Document | Purpose |
|---|---|
| [README.md](./README.md) | This file — overview, quickstart, feature list |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data model, auth flow, deployment topology |
| [API.md](./API.md) | Every API route, method, request body, and response shape |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Step-by-step Vercel + Turso + Resend setup |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Local dev setup, code style, PR process |

---

## License

UNLICENSED — proprietary to RA Syncbot Ltd.
