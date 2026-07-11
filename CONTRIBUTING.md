# Contributing

Thanks for working on RA Syncbot. This document covers local setup, code style, and the PR process.

---

## Local Development

### Prerequisites
- [Bun](https://bun.sh) 1.0+ (preferred) or Node.js 18+
- A Turso account (free) — or use the local SQLite fallback

### First-time setup

```bash
# 1. Clone
git clone https://github.com/FamineDT246/RASchedule.git
cd RASchedule

# 2. Install deps
bun install

# 3. Configure env
cp .env.example .env
# Edit .env — at minimum set SESSION_PASSWORD (32+ chars)
#   openssl rand -hex 32

# 4. (Optional) Seed the DB with demo data
bun run seed

# 4b. (Existing deployments only) Run migrations to add new tables/columns
bun run migrate

# 5. Start dev server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Without Turso configured**, the app falls back to `file:./db/custom.db` (local SQLite). The seed script creates this file automatically.

---

## Project Layout

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full breakdown. Key directories:

```
src/
├── app/
│   ├── api/             # 22 route handlers — one folder per resource
│   ├── page.tsx         # Main app shell (auth gate, tabs, DnD, drawers)
│   ├── layout.tsx       # Root layout + metadata + icons
│   └── providers.tsx    # TanStack Query + theme + Sonner + SW registration
├── components/
│   ├── scheduler/       # 20 app-specific components
│   └── ui/              # 1 shadcn/ui component (sonner toaster only)
├── hooks/
│   └── use-is-mobile.ts
└── lib/
    ├── auth-helpers.ts  # getAuthUser + requireAdmin
    ├── db.ts            # Turso client
    ├── email.ts         # Resend wrapper + digest queue + notifications
    ├── scheduler-types.ts  # Shared types + date helpers + color maps
    └── session.ts       # HMAC cookies (server-only)
```

---

## Code Style

### TypeScript
- **Strict mode** is on — no implicit `any`, no unchecked index access.
- All shared types live in `src/lib/scheduler-types.ts`. Don't duplicate types inline.
- Use `type` for unions and intersections; use `interface` only when you need declaration merging.
- Prefer `unknown` over `any` for unknown API payloads; narrow with type guards.

### React
- **Function components only.** No class components.
- **Hooks rule:** never call hooks conditionally. The scheduler sensors are always created (even on mobile) — we just set an impossible activation distance to disable them.
- **No `useSyncExternalStore`** — it caused a TDZ crash in this project. Use `useState + useEffect` for client-only state.
- **TanStack Query** for all server state. Don't use `useEffect` for data fetching.
- Keep components under ~400 lines. Split larger components into sub-components in the same file.

### Styling
- **Tailwind CSS 4** — utility classes inline. No CSS modules.
- Use the `cn()` helper from `src/lib/utils.ts` for conditional classes.
- **WCAG 2.1 AA** is enforced:
  - 16px base text, 12px absolute floor (enforced in `globals.css`)
  - 44px minimum touch targets on mobile (enforced in `globals.css` `@media (pointer: coarse)`)
  - All interactive elements must have an `aria-label` if their text content is ambiguous
- Dark mode is via `next-themes` — use Tailwind's `dark:` variant, never hardcode colors.
- Light mode variables are tuned for contrast (darker borders, darker muted text) — see `globals.css` `:root`.

### API routes
- Every route starts with `getAuthUser(req)` or `requireAdmin(req)`.
- Validate the request body before touching the DB. Return `400` with a clear error message.
- Run server-side conflict checks (don't trust the client) for assignment mutations.
- Return `200` with the updated entity, not a generic `{ ok: true }`. The client uses the response to update the cache.
- Use `crypto.randomUUID()` for IDs — never `Date.now()` or counter-based IDs.

### SQL
- Raw SQL via `db.execute({ sql, args })`. **Always use `?` placeholders** — never string-interpolate user input.
- Column names are camelCase (matches the JS object shape). Table names are PascalCase.
- For complex queries, write the SQL as a template literal with the placeholders on separate lines for readability.
- When adding new tables/columns, add them to `scripts/migrate.ts` (idempotent — uses `IF NOT EXISTS`).

### Email
- All user-supplied values interpolated into HTML email bodies must be wrapped in `escapeHtml()` (defined in `src/lib/email.ts`).
- Use `notifyUser()` for any notification that should create both an in-app bell notification AND an email. Don't call `sendEmail()` directly for user-facing notifications.
- Verification codes + welcome emails bypass the per-user email toggle (transactional) — call `sendEmail()` directly for those.

### File naming
- Components: `PascalCase.tsx` (e.g. `EventDetailDrawer.tsx`)
- Hooks: `kebab-case.ts` (e.g. `use-is-mobile.ts`)
- Lib files: `kebab-case.ts` (e.g. `auth-helpers.ts`)
- API routes: `route.ts` inside a folder named after the resource

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body — optional>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Examples:
```
feat(scheduler): add multi-day drop handle
fix(auth): prevent session cookie from leaking to client bundle
docs(api): document /api/opt-ins response shape
chore(deps): remove unused Radix packages
```

---

## Pull Request Process

1. **Branch** from `main`: `feat/<short-description>` or `fix/<short-description>`.
2. **Commit** logically — one feature/fix per commit. Squash WIP commits before opening the PR.
3. **Test locally:**
   ```bash
   bun run lint   # must pass with no errors
   bun run build  # must succeed
   ```
4. **Open the PR** against `main`. Describe:
   - What changed and why
   - How to test it
   - Screenshots (if UI changes)
5. **Review** — address feedback by pushing new commits (don't force-push during review).
6. **Squash-merge** on approval.

---

## Testing

There's no automated test suite yet. Manual test checklist before merging:

- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] Dev server starts without console errors
- [ ] Login works (admin + instructor)
- [ ] Drag-and-drop works on desktop (Chrome + Firefox)
- [ ] Tap-to-assign works on mobile (iOS Safari + Android Chrome)
- [ ] Esc closes drawers, modals, and tap selections
- [ ] Light/dark mode toggle works
- [ ] No `Cannot access 'g' before initialization` errors in console
- [ ] Notification bell shows unread count + marks read on click
- [ ] Equipment claims work (instructor can claim, admin sees claims)
- [ ] Skill picker closes on blur + Escape

---

## Known Pitfalls

### Don't import `session.ts` from client code
`session.ts` is marked `server-only` and uses `crypto.subtle`. If you accidentally import it from a client component, the build will fail (good) or — worse — leak into the client bundle and cause a TDZ crash at runtime.

### Don't use `useSyncExternalStore`
This caused a desktop-only crash that took a full session to diagnose. Use `useState + useEffect` instead, even at the cost of an extra render.

### Don't run `bun run seed` against production
The seed script wipes all data. It's safe for local dev and for the initial Turso setup, but never run it against a DB with real data. The `/api/seed` endpoint is disabled in production (returns 403) as a safety net.

### Don't add shadcn/ui components back without checking usage
The `src/components/ui/` directory was pruned from 40+ components down to 1 (`sonner`). If you need a new component, add it manually (don't run `npx shadcn add` — it pulls in deps we removed).

### Don't change the auth cookie scheme without testing
The HMAC-signed cookie approach replaced iron-session (which had Vercel build issues) and a Node `crypto` version (which caused the desktop crash). Any change to `session.ts` needs testing on both desktop and mobile, in both light and dark mode.

### Always run `bun run migrate` after pulling
If a PR adds new tables or columns, the migration script (`scripts/migrate.ts`) must be run against your local DB and the production Turso DB. The script is idempotent — safe to run multiple times. If you add a new table or column, add the migration to this script (don't rely on on-demand `CREATE TABLE` in API routes alone — that's a fallback, not the primary path).

### Escape HTML in email templates
The `escapeHtml()` helper in `src/lib/email.ts` must be applied to every user-supplied value interpolated into HTML email bodies. Event names, user names, shirt colors — all can contain `<`, `>`, `&` characters that break email HTML or carry injection payloads. Never interpolate raw user input into email HTML.

### Service worker cache busting
When you change `public/sw.js`, bump `CACHE_NAME` to a new version so old caches are cleared on activate. The current version is `ra-syncbot-cache-v2`.

### PWA icon format
PWA maskable icons (`purpose: "any maskable"`) must be fully opaque — no transparency. The `generate-icons.ts` script generates opaque versions for this purpose. The transparent `logo.png` is for in-app header use only, not for PWA installation.

### Browser PWA uninstall cooldown
Chromium browsers suppress `beforeinstallprompt` for 1-2 weeks after a user manually uninstalls a PWA. This is browser-level behavior, not a bug in the app. For testing, use `chrome://flags` → "Bypass user engagement checks".

---

## Getting Help

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design questions
- Read [API.md](./API.md) for endpoint specifics
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for infra setup + troubleshooting
- Check `git log` for context on past decisions — commit messages explain why things were done
