# RA Syncbot — Project Overview for AI Assessment

> This document is designed to be fed into an AI agent for technical assessment, codebase evaluation, and pricing quotes. It contains a complete summary of the project scope, architecture, features, and technical decisions.

---

## Project Summary

**RA Syncbot** is a production-grade, drag-and-drop instructor scheduling application built for RA Syncbot Ltd (Barbados). It replaces a chaotic spreadsheet-based system for managing 19+ instructors across 15+ camps and workshops during the summer season.

**Live URL:** https://ra-schedule.vercel.app  
**Repository:** https://github.com/FamineDT246/RASchedule  
**Domain:** ra-syncbot.com (pending DNS configuration)

---

## Problem Solved

The organization previously managed instructor scheduling through a static spreadsheet with 19 staff, 15+ events, multiple locations, and dozens of assignments. Issues included:
- Double-booking instructors across overlapping events
- No visibility into skill gaps or equipment needs
- No way for instructors to express availability
- Manual shirt color tracking per day per event
- No conflict detection or fatigue warnings
- No mobile access for instructors in the field

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16 (App Router) | React 19, Turbopack, server components |
| Language | TypeScript 5 (strict) | Type safety across full stack |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first, consistent design system |
| Database | Turso (libSQL/SQLite cloud) | Free tier, SQLite-compatible, zero cold start |
| DB Client | @libsql/client (raw SQL) | Direct control, no ORM overhead |
| Auth | bcryptjs + HMAC-signed cookies | Encrypted session tokens, can't be forged |
| Drag & Drop | @dnd-kit/core | Accessible, performant, React 19 compatible |
| Server State | TanStack Query v5 | Caching, invalidation, optimistic updates |
| Animations | Framer Motion | Drawer transitions, layout animations |
| Icons | Lucide React | 1000+ icons, tree-shakeable |
| Email | Resend API (fetch) | Assignment notifications, 2-day reminders |
| Hosting | Vercel | Auto-deploy from GitHub, serverless functions |
| PWA | manifest.json + icons | Installable on mobile/desktop |

---

## Feature List

### Admin (Boss) Features
1. **Scheduler** — Week grid view, drag-and-drop (desktop) / tap-to-assign (mobile), conflict detection
2. **Calendar** — Full month grid view with all events, color-coded by host, click to view details
3. **Events** — Full CRUD with status workflow (Draft→Tentative→Confirmed→Cancelled→Archived), recurring events, setup dates
4. **Team** — Staff directory (card view) + edit mode (CRUD), role tiers, skills, availability
5. **Conflicts** — Auto-detection: double-bookings, unavailable violations, fatigue streaks (>5 days), unfilled slots, skill gaps
6. **Workload** — Dashboard with color-coded bars showing assignments per instructor
7. **Invites** — Generate invite links, share via WhatsApp/email/copy, see claimed status
8. **Export** — CSV (Excel-compatible) + PDF (print-optimized weekly schedule)
9. **Notifications** — Bell icon with recent opt-ins, auto-refresh every 60s
10. **Security** — Password login, server-side role checks on all mutation endpoints

### Instructor Features
1. **My Assignments** — Tab showing all assignments with event details, shirt color, alt status
2. **Opt In** — Tab showing all events, express interest (Interested/Available/Can't), tap for details
3. **Calendar** — Month grid view, ★ on assigned days, click events for details
4. **Availability** — Set unavailable dates (blocks assignments on those days)
5. **Account** — Change password, subscribe to calendar (iCal), log out
6. **Email verification** — 6-digit code sent to email on account claim
7. **Email notifications** — Assignment created/removed emails, 2-day reminder emails

### Cross-cutting Features
1. **Past date protection** — Past assignments locked (read-only), API blocks creating past assignments
2. **Auto-archive** — Events past their end date automatically archived
3. **Skill matcher** — Informational (non-blocking) — shows missing skills per instructor, never blocks assignment
4. **Bulk shirt color** — Set all instructors' shirt color for a day in one click
5. **Multi-day drag** — Drag onto "↧ all days" to assign to all days of a multi-day event
6. **Barbados timezone** — All date comparisons use America/Barbados (AST, UTC-4)
7. **PWA** — Installable with app icon, standalone display mode
8. **Light/dark theme** — System preference + manual toggle
9. **WCAG accessibility** — 16px base text, 12px minimum, 44px touch targets, ARIA roles, keyboard nav
10. **Back button protection** — Intercepted to prevent accidental app exits
11. **Help tooltips** — Click-only ? icon on every page with usage instructions
12. **iCal sync** — Instructors subscribe to their schedule on their phone calendar

---

## Architecture

```
Browser (Client)
  ├── Admin: 7 tabs (Scheduler, Calendar, Events, Team, Conflicts, Workload, Invites)
  ├── Instructor: 3 tabs (Assignments, Opt In, Calendar)
  └── TanStack Query (fetch + cache + invalidate)
        │
        │ HTTP (fetch)
        ▼
Next.js API Routes (Serverless)
  ├── /api/auth/* — Login, claim (with email verification), logout, change-password
  ├── /api/schedule — Combined data endpoint (profiles + events + assignments + opt-ins)
  ├── /api/events — CRUD (admin only)
  ├── /api/profiles — CRUD + /me endpoint
  ├── /api/assignments — CRUD + /bulk for multi-day
  ├── /api/invites — CRUD (admin only)
  ├── /api/opt-ins — Instructor opt-in management
  ├── /api/notifications — In-app notification feed
  ├── /api/ical — iCal calendar feed
  ├── /api/auto-archive — Auto-archive past events
  ├── /api/reminders — Send 2-day email reminders
  └── /api/seed — DISABLED in production
        │
        │ libSQL protocol
        ▼
Turso (libSQL cloud database)
  ├── Profile (20 staff members)
  ├── Event (17 events: 9 Confirmed, 8 Draft)
  ├── EventSkill (45 skill mappings)
  ├── Assignment (33 assignments with shirt colors)
  ├── User (admin + instructor accounts)
  └── OptIn (instructor preferences)
```

---

## Database Schema

6 tables with indexes, foreign keys, and cascade deletes. See ARCHITECTURE.md for full SQL.

---

## Security Implementation

1. **HMAC-signed cookies** — Session cookie = `userId.hmac(userId)` using SESSION_PASSWORD. Can't be forged.
2. **Server-side role checks** — `requireAdmin(req)` on every mutation endpoint. Returns 401/403 if not admin.
3. **bcrypt password hashing** — All passwords hashed with 10 rounds.
4. **Email verification** — 6-digit code on account claim, 10-minute expiry.
5. **Past date blocking** — API returns 400 for assignments on past dates.
6. **Seed endpoint disabled** — Returns 403 in production.
7. **httpOnly cookies** — Can't be read by JavaScript.
8. **SameSite: lax** — CSRF mitigation.

---

## Codebase Stats

| Metric | Value |
|--------|-------|
| Source files | ~35 TypeScript/TSX files |
| Lines of code | ~6,000 (src/) + ~500 (scripts/) |
| API endpoints | 20+ routes |
| Components | 20 React components |
| Dependencies | 38 production, 8 dev |
| Database tables | 6 |
| Documentation | 5 markdown files (~3,000 lines) |

---

## Deployment

- **Hosting:** Vercel (free tier)
- **Database:** Turso (free tier — 500 databases, 9GB)
- **Email:** Resend (free tier — 100 emails/day)
- **Domain:** ra-syncbot.com (pending DNS)
- **Total monthly cost:** $0

---

## Documentation Included

1. **README.md** — Quick start, features, tech stack, project structure
2. **ARCHITECTURE.md** — Design decisions, DB schema SQL, how to add features
3. **API.md** — All 20+ endpoints documented with auth, body, response format
4. **CONTRIBUTING.md** — Dev setup, coding standards, common tasks, debugging
5. **TURSO-DEPLOYMENT-GUIDE.md** — Step-by-step deployment guide
6. **AI-OVERVIEW.md** — This document

---

## What Would a Developer Need to Maintain This?

A junior-to-mid developer with:
- TypeScript + React experience
- Basic SQL knowledge (SELECT, INSERT, UPDATE, DELETE with parameterized queries)
- Next.js App Router understanding (API routes, server/client components)
- Tailwind CSS familiarity
- Git workflow

The codebase is documented, lint-clean, and follows consistent patterns. Every API route uses the same structure: auth check → SQL query → JSON response. Every component uses shadcn/ui + Tailwind utilities. No complex abstractions.

---

## Pricing Assessment Criteria

When quoting a price for this project, consider:

1. **Scope:** 7 admin tabs + 3 instructor tabs + 20+ API endpoints + auth system + email + PWA + iCal + security hardening
2. **Custom vs template:** This is a custom-built app, not a template. Every feature was built from scratch for this specific workflow.
3. **Comparable commercial software:** Scheduling tools like When2Work ($50-200/mo per user), Calendly ($15-50/mo per user), Deputy ($40/mo per user) — all charge ongoing per-user fees. This is a one-time build with $0 hosting.
4. **Data migration:** Real data from a PDF spreadsheet was extracted and seeded (20 staff, 17 events, 33 assignments).
5. **Security:** HMAC-signed cookies, server-side role checks, email verification, bcrypt hashing.
6. **Accessibility:** WCAG 2.1 AA compliant (16px text, 44px touch targets, ARIA, keyboard nav).
7. **Mobile:** Full mobile support with tap-to-assign, responsive layouts, PWA install.
8. **Documentation:** 5 documentation files + inline JSDoc comments + clean code structure.
