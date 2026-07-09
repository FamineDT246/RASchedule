# Robot Adventure Scheduler

A drag-and-drop camp & workshop instructor scheduling app for Robot Adventure.

## Quick Start (Local Development)

```bash
# Install dependencies
bun install

# Set up the database
cp .env.example .env
bun run db:push

# Seed with initial data (staff, events, assignments)
bun run scripts/seed.ts

# Start the dev server
bun run dev
```

Open http://localhost:3000

**Default admin login:** `jelani@robotadventure.local` / `changeme`
⚠️ Change this password immediately after first login!

## Deploying Online

See **[TURSO-DEPLOYMENT-GUIDE.md](./TURSO-DEPLOYMENT-GUIDE.md)** for step-by-step instructions to deploy free on Vercel + Turso.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** Prisma ORM + SQLite (local) / Turso libSQL (production)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Drag & Drop:** @dnd-kit/core
- **State:** TanStack Query + Zustand
- **Auth:** bcryptjs + httpOnly cookies

## Features

- **Scheduler** — drag-and-drop (desktop) or tap-to-assign (mobile) instructors onto events
- **Events** — manage camps/workshops with status (Draft/Tentative/Confirmed/Cancelled), recurring events, specific dates
- **Team** — manage staff info, availability, contracts
- **Conflicts** — auto-detect double-bookings, unavailable violations, fatigue streaks, unfilled slots
- **Invites** — generate invite links for instructors, share via WhatsApp/email
- **Instructor view** — opt in to events, set availability, view schedule
- **Print** — print-friendly weekly schedule with shirt colors
- **Auth** — password-based login, change password, role-based access (admin/instructor)

