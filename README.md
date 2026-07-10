# Robot Adventures — Camp Scheduler

A production-grade, drag-and-drop instructor scheduling application for Robot Adventures (Barbados).

Built with **Next.js 16**, **TypeScript**, **Tailwind CSS 4**, **shadcn/ui**, and **Turso (libSQL)**.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Default Login](#default-login)
- [Documentation](#documentation)
- [License](#license)

---

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Turso credentials (see below)

# 3. Create the database schema
bun run scripts:db-init

# 4. Seed with initial data
bun run seed

# 5. Start the dev server
bun run dev
```

Open http://localhost:3000

---

## Features

### Admin (Boss)
- **Scheduler** — Drag-and-drop (desktop) or tap-to-assign (mobile) instructors onto events
- **Calendar** — Full month grid view of all events with fill counts and color-coded hosts
- **Events** — CRUD with status workflow (Draft → Tentative → Confirmed → Archived), recurring events, specific dates
- **Team** — Staff directory + edit mode with full CRUD on instructor profiles
- **Conflicts** — Auto-detect double-bookings, unavailable violations, fatigue streaks, unfilled slots
- **Workload** — Dashboard showing assignments per instructor with color-coded workload bars
- **Invites** — Generate invite links for instructors, share via WhatsApp/email/copy
- **Export** — CSV (opens in Excel) and PDF (print-optimized layout)
- **Security** — Password-based login, role-based access control, server-side auth checks

### Instructors
- **Schedule view** — Carousel or list of assignments + opt-in events
- **Month calendar** — Read-only calendar showing all events with ★ on their assignment days
- **Opt-ins** — Express interest (Interested / Available / Can't make it)
- **Availability** — Set their own unavailable dates
- **Account** — Change password, log out

### Cross-cutting
- **Past date protection** — Past assignments are locked (read-only)
- **Auto-archive** — Events past their end date are automatically archived
- **PWA** — Installable on mobile/desktop with app icon
- **Barbados timezone** — All date comparisons use America/Barbados (AST, UTC-4)
- **Mobile responsive** — Single-day view on mobile, week grid on desktop
- **Accessibility** — ARIA roles, keyboard nav, skip links, focus management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York style) |
| Database | Turso (libSQL/SQLite cloud) |
| DB Client | @libsql/client (raw SQL, no ORM) |
| Auth | bcryptjs + httpOnly cookies |
| Drag & Drop | @dnd-kit/core |
| State | TanStack Query (server) + React hooks (client) |
| Animations | Framer Motion |
| Icons | Lucide React |
| Hosting | Vercel |
| Database hosting | Turso (free tier) |

---

## Project Structure

```
robot-adventures-scheduler/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (fonts, providers, metadata, PWA)
│   │   ├── page.tsx                  # Main page (auth gate, tab nav, all views)
│   │   ├── providers.tsx             # QueryClient + ThemeProvider + Toaster
│   │   ├── globals.css               # Tailwind imports + print styles + scrollbars
│   │   └── api/                      # API routes (see API.md)
│   │       ├── auth/                 # Login, claim, logout, change-password, me
│   │       ├── schedule/             # Combined schedule data (events + assignments + opt-ins)
│   │       ├── events/               # Event CRUD
│   │       ├── profiles/             # Staff CRUD + /me endpoint
│   │       ├── assignments/          # Assignment CRUD + /bulk for multi-day
│   │       ├── invites/              # Invite link generation
│   │       ├── opt-ins/              # Instructor opt-in management
│   │       ├── auto-archive/         # Auto-archive past events
│   │       └── seed/                 # DISABLED in production
│   ├── components/
│   │   ├── scheduler/                # All scheduler-specific components
│   │   │   ├── StatsBar.tsx          # Top bar with stats + user menu
│   │   │   ├── RosterRail.tsx        # Left sidebar (instructor list)
│   │   │   ├── CalendarGrid.tsx      # Week view (desktop) / day view (mobile)
│   │   │   ├── CalendarView.tsx      # Month grid (Calendar tab)
│   │   │   ├── DroppableEventCard.tsx # Event card on the scheduler grid
│   │   │   ├── DraggableInstructor.tsx # Draggable instructor card
│   │   │   ├── EventDetailDrawer.tsx  # Right-side detail drawer
│   │   │   ├── EventsManagerTab.tsx   # Events CRUD tab
│   │   │   ├── TeamTab.tsx            # Staff directory + edit tab
│   │   │   ├── ConflictSummaryTab.tsx # Conflict detection tab
│   │   │   ├── WorkloadTab.tsx        # Instructor workload dashboard
│   │   │   ├── InvitesTab.tsx         # Invite generation tab
│   │   │   ├── InstructorView.tsx     # Instructor portal (carousels + calendar)
│   │   │   ├── LoginForm.tsx          # Email + password login
│   │   │   ├── PrintLayout.tsx        # Print-optimized weekly schedule
│   │   │   ├── PWAInstallPrompt.tsx   # PWA install banner
│   │   │   └── Accordion.tsx          # Reusable collapsible component
│   │   └── ui/                        # shadcn/ui component library
│   ├── lib/
│   │   ├── db.ts                      # Database client (Turso/libSQL)
│   │   ├── auth-helpers.ts            # requireAdmin() / requireAuth() middleware
│   │   ├── conflicts.ts               # Pure conflict-detection functions
│   │   ├── scheduler-types.ts         # Shared types, color maps, date helpers
│   │   └── export-utils.ts            # CSV generation + file download
│   └── hooks/
│       └── use-is-mobile.ts           # Viewport detection hook
├── public/                            # Static assets (PWA icons, manifest)
├── scripts/
│   └── seed.ts                        # Database seed script
├── vercel.json                        # Vercel config (framework detection)
├── next.config.ts                     # Next.js config
├── tailwind.config.ts                 # Tailwind config
├── tsconfig.json                      # TypeScript config
└── .env.example                       # Environment variable template
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed walkthrough of the codebase.

---

## Database Schema

The database uses SQLite (via Turso's libSQL). There are 6 tables:

| Table | Purpose |
|-------|---------|
| `Profile` | Staff members (name, role, skills, availability, contract status) |
| `Event` | Camps/workshops (name, host, dates, times, status, required instructors) |
| `EventSkill` | Required skills per event (many-to-one) |
| `Assignment` | Instructor assigned to an event on a specific date (with shirt color, alt flag) |
| `User` | Login accounts (email, password hash, role: admin/instructor, invite token) |
| `OptIn` | Instructor opt-in preferences per event (interested/available/unavailable) |

The schema is created by the seed script. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full SQL.

---

## Environment Variables

See `.env.example` for a template:

```bash
# Database (Turso cloud — required for production)
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Local development fallback (optional — used if TURSO_URL is not set)
DATABASE_URL=file:./db/custom.db
```

**Never commit `.env` to git.** It is in `.gitignore`.

---

## Deployment

See [TURSO-DEPLOYMENT-GUIDE.md](./TURSO-DEPLOYMENT-GUIDE.md) for step-by-step instructions to deploy free on Vercel + Turso.

---

## Default Login

After seeding:

| | |
|---|---|
| Email | `jelani@robotadventure.local` |
| Password | `changeme` |

⚠️ **Change this password immediately after first login** via the user menu → Change password.

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Codebase structure, patterns, and how things work
- [API.md](./API.md) — All API endpoints with request/response examples
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development setup, coding standards, and how to add features
- [TURSO-DEPLOYMENT-GUIDE.md](./TURSO-DEPLOYMENT-GUIDE.md) — Step-by-step deployment guide

---

## License

UNLICENSED — Proprietary. All rights reserved.
