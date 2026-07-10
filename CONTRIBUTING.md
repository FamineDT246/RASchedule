# Contributing Guide

This guide is for developers maintaining or extending the Robot Adventures Scheduler.

---

## Development Setup

### Prerequisites

- **Node.js 18+** or **Bun** (recommended — faster installs + runs)
- A Turso account (free at [turso.tech](https://turso.tech))
- Git

### First-time Setup

```bash
# Clone the repo
git clone https://github.com/FamineDT246/RASchedule.git
cd RASchedule

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your Turso URL + auth token

# Create the database schema (run the SQL from ARCHITECTURE.md in Turso's web inspector,
# or use the seed script which creates tables if they don't exist)
bun run seed

# Start the dev server
bun run dev
```

Open http://localhost:3000

**Default login:** `jelani@robotadventure.local` / `changeme`

---

## Coding Standards

### TypeScript

- **Strict mode** is on — no `any` unless absolutely necessary (and add a comment explaining why)
- All function parameters and return types should be typed
- Use `type` for object shapes, `interface` for things that might be extended
- Prefer `unknown` over `any` for catch blocks

### React

- Use **functional components** only (no class components)
- Use **hooks** for state management (`useState`, `useCallback`, `useMemo`)
- Extract reusable logic into custom hooks in `src/hooks/`
- Use **TanStack Query** for all server state (no manual `useEffect` fetches)
- Use **sonner** toasts for user feedback (not `alert()` or `confirm()`)

### File Naming

- Components: `PascalCase.tsx` (e.g., `EventDetailDrawer.tsx`)
- Utilities: `kebab-case.ts` (e.g., `auth-helpers.ts`)
- API routes: `route.ts` inside a folder named after the endpoint

### CSS / Styling

- Use **Tailwind CSS 4** utility classes — no inline styles unless dynamic values
- Use **shadcn/ui** components from `src/components/ui/` — don't reinvent buttons, dialogs, etc.
- **No indigo or blue** as primary colors (per project rules)
- Always use `cn()` from `@/lib/utils` for conditional classes
- Responsive: mobile-first (`sm:`, `md:`, `lg:` prefixes)
- Minimum touch target: 32px (36px preferred for primary actions)

### Database

- Use **parameterized queries** always — never string-interpolate SQL
- Pattern: `db.execute({ sql: 'SELECT * FROM X WHERE id = ?', args: [id] })`
- Date columns use ISO 8601 strings (`YYYY-MM-DDTHH:MM:SS.SSSZ`)
- All tables have `createdAt` and `updatedAt` DATETIME columns

### API Routes

- Every mutating endpoint (POST/PUT/PATCH/DELETE) must call `requireAdmin(req)` first
- Return proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Return `{ error: string }` for errors, not bare strings
- Use `NextRequest` and `NextResponse` from `next/server`

---

## Common Tasks

### Adding a new staff member

1. Log in as admin
2. Go to **Team** tab → switch to **Edit** mode → click **Add staff**
3. Fill in name, role, role tier, skills, availability
4. Save

### Creating an invite for a staff member

1. Go to **Invites** tab → click **New invite**
2. Select the staff member from the dropdown
3. Copy the invite link and share via WhatsApp/email
4. The instructor opens the link, sets their email + password, and claims their account

### Adding a new event

1. Go to **Events** tab → click **New event**
2. Fill in event details (name, host, dates, times, required instructors)
3. For recurring events: check **Recurring event**, select weekdays, set number of weeks
4. Set status to **Draft** if dates aren't confirmed yet, **Confirmed** if they are
5. Save

### Assigning instructors

1. Go to **Scheduler** tab
2. **Desktop:** Drag an instructor from the left roster onto an event card
3. **Mobile:** Tap an instructor to select them, then tap an event card
4. For multi-day events: drag onto the **"↧ all days"** button to assign to all days at once
5. Conflict warnings (double-booking, unavailable) will block or warn

### Running the seed script

```bash
bun run seed
```

This wipes all data and inserts the initial dataset. **Never run this in production** — it's for local development only. The `/api/seed` endpoint is disabled in production.

---

## Debugging

### Checking the database

Use Turso's web inspector at [turso.tech](https://turso.tech) → your database → Inspector. You can run SQL queries directly.

Alternatively, use the CLI:
```bash
turso db shell robot-adventure-db
```

### Checking Vercel logs

1. Go to [vercel.com](https://vercel.com) → your project
2. Click **Functions** → **Logs**
3. Look for `console.error` outputs

### Common issues

| Issue | Fix |
|-------|-----|
| "URL_INVALID" error | Check that `TURSO_URL` and `TURSO_AUTH_TOKEN` are set in Vercel env vars |
| 404 on production | Check that `vercel.json` has `"framework": "nextjs"` |
| Login fails | Check that the User table has a row with the correct email + passwordHash |
| Build fails | Run `bun run lint` locally to catch issues before pushing |
| Hydration mismatch | Don't read `window` or `document` during render — use `useSyncExternalStore` or `useEffect` |

---

## Git Workflow

1. Create a branch: `git checkout -b feature/your-feature-name`
2. Make changes, commit with clear messages
3. Push: `git push origin feature/your-feature-name`
4. Vercel auto-deploys on push to `main`
5. For production: merge to `main` via PR or direct push

### Commit Message Format

```
Brief description (50 chars max)

Optional longer description explaining what changed and why.
```

Examples:
```
Add instructor workload dashboard
Fix past-date assignment blocking on bulk assign
Replace Prisma with @libsql/client for Turso compatibility
```

---

## Security Checklist

Before deploying any changes:

- [ ] No secrets in code or git (use env vars)
- [ ] All new API mutations have `requireAdmin(req)` check
- [ ] No `confirm()` or `alert()` calls (use sonner toasts)
- [ ] No `console.log` left in production code (use `console.error` for errors only)
- [ ] Lint passes: `bun run lint`
- [ ] Build passes: `bun run build`
- [ ] Tested on mobile viewport (390px width)
