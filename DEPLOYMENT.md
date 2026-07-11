# Deployment Guide

This guide walks you through deploying RA Syncbot from scratch on Vercel + Turso + Resend. Total cost on free tiers: $0.

Estimated setup time: 30–45 minutes.

---

## Prerequisites

- A [GitHub](https://github.com) account (to host the repo)
- A [Vercel](https://vercel.com) account (free tier)
- A [Turso](https://turso.tech) account (free tier)
- A [Resend](https://resend.com) account (free tier, optional — for email notifications)
- A domain name (optional — Vercel provides a free `*.vercel.app` subdomain)

---

## Step 1 — Push the code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<your-username>/ra-syncbot.git
git push -u origin main
```

If you received this project as a zip, unzip it first and run the commands above from inside the project directory.

---

## Step 2 — Create the Turso database

1. Sign up at [turso.tech](https://turso.tech) (free, no credit card).
2. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   turso auth login
   ```
3. Create a database:
   ```bash
   turso db create ra-syncbot
   ```
4. Get the connection URL:
   ```bash
   turso db show ra-syncbot --url
   # → libsql://ra-syncbot-<your-org>.turso.io
   ```
5. Create an auth token:
   ```bash
   turso db tokens create ra-syncbot
   # → eyJhbGciOi... (long string)
   ```
6. Save both values — you'll need them in Step 4.

---

## Step 3 — Initialize the database schema

The schema isn't included as a SQL file — it's created by the seed script.

1. Clone the repo locally and install deps:
   ```bash
   git clone https://github.com/<your-username>/ra-syncbot.git
   cd ra-syncbot
   bun install
   ```
2. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and fill in:
   ```
   TURSO_URL=libsql://ra-syncbot-<your-org>.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOi...
   SESSION_PASSWORD=<generate a 32+ char random string>
   ```
   Generate a session password:
   ```bash
   openssl rand -hex 32
   ```
4. Run the seed:
   ```bash
   bun run seed
   ```
   You should see output like:
   ```
   Seeding 20 staff profiles...
   Seeding 17 events...
   Seeding 33 preset assignments...
   Creating admin user...
   Done!
   ```

> ⚠️ The seed script **wipes all existing data** before inserting. It is safe to run multiple times, but don't run it in production after you have real data.

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import your `ra-syncbot` repository.
3. Vercel auto-detects Next.js. **Don't override any build settings** — `vercel.json` in the repo already configures everything.
4. Open **Environment Variables** and add:
   | Key | Value |
   |---|---|
   | `TURSO_URL` | `libsql://ra-syncbot-<your-org>.turso.io` |
   | `TURSO_AUTH_TOKEN` | (your Turso token) |
   | `SESSION_PASSWORD` | (your 32+ char secret) |
   | `NODE_ENV` | `production` |
5. (Optional — email) Add:
   | Key | Value |
   |---|---|
   | `RESEND_API_KEY` | `re_...` (from Resend dashboard) |
   | `FROM_EMAIL` | `noreply@yourdomain.com` (must be a verified Resend domain) |
   | `ADMIN_EMAIL` | `you@example.com` (receives opt-in notifications) |
6. Click **Deploy**. The first build takes ~2 minutes.

Once deployed, Vercel gives you a `*.vercel.app` URL. The app is now live.

---

## Step 5 — Configure your custom domain (optional)

1. In the Vercel dashboard, go to **Project → Settings → Domains**.
2. Add `ra-syncbot.com` (or your domain).
3. Vercel shows you DNS records to add at your registrar:
   - `A` record: `@ → 76.76.21.21`
   - `CNAME` record: `www → cname.vercel-dns.com`
4. Add the records at your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.).
5. Wait 5–60 minutes for DNS propagation. Vercel auto-provisions SSL.

---

## Step 6 — Configure Resend (optional, for email)

If you want email notifications (assignment alerts, opt-in receipts, daily reminders):

1. Sign up at [resend.com](https://resend.com) (free, 100 emails/day).
2. Go to **Domains → Add Domain**.
3. Enter your domain (e.g. `ra-syncbot.com`).
4. Resend gives you 3 DNS records to add:
   - `MX` record
   - `TXT` record (SPF)
   - `TXT` record (DKIM)
5. Add them at your registrar and click **Verify** in Resend (usually takes 5–30 minutes).
6. Go to **API Keys → Create API Key** → copy the `re_...` key.
7. Add it to Vercel env vars (as `RESEND_API_KEY`) and redeploy.

**Without Resend configured**, the app works fine — email sending is silently skipped. The claim flow skips email verification in dev mode.

---

## Step 7 — Configure Vercel Cron (optional, for reminders + auto-archive)

Add a `crons` section to `vercel.json`:

```json
{
  "framework": "nextjs",
  "buildCommand": "bun run build",
  "installCommand": "bun install",
  "functions": {
    "src/app/**/*.{ts,tsx}": { "maxDuration": 30 }
  },
  "crons": [
    { "path": "/api/reminders", "schedule": "0 8 * * *" },
    { "path": "/api/auto-archive", "schedule": "0 2 * * *" }
  ]
}
```

- `0 8 * * *` — daily reminders at 08:00 UTC (04:00 AST Barbados)
- `0 2 * * *` — auto-archive past events at 02:00 UTC (22:00 AST previous day)

Commit and push — Vercel picks up the cron config on the next deploy.

> Vercel Cron on the free tier runs once per day per cron job. If you need more frequent runs, upgrade to Pro.

---

## Step 8 — Verify the deployment

1. Visit your Vercel URL (or custom domain).
2. Log in with the admin credentials created by the seed:
   - Email: `robotadventuresltd@gmail.com`
   - Password: `admin123`
3. **Immediately change the password** via the account menu (top-right) → Change password.
4. Walk through the tabs:
   - **Scheduler** — drag an instructor onto an event
   - **Calendar** — click an event chip
   - **Events** — edit an event
   - **Team** — view instructor profiles
   - **Invites** — create an invite link and open it in an incognito window to test the claim flow

---

## Troubleshooting

### Build fails with "Cannot find module"
Run `bun install` locally to regenerate `bun.lock`, then commit and push.

### 401 on every API call after deploying
You forgot to set `SESSION_PASSWORD` in Vercel env vars, or the seed didn't run. Re-run the seed locally with the same `SESSION_PASSWORD` you set in Vercel.

### Drag-and-drop crashes on desktop (`Cannot access 'g' before initialization`)
This was a historical bug caused by Node's `crypto` module leaking into the client bundle. It's fixed — `session.ts` uses Web Crypto (`crypto.subtle`) and is marked `server-only`. If you see this error again, check that no API route imports from `src/lib/session.ts` directly in a way that gets bundled client-side.

### Emails not sending
- Check that `RESEND_API_KEY` and `FROM_EMAIL` are set in Vercel env vars.
- Check that the `FROM_EMAIL` domain is **verified** in Resend.
- Check the Notifications tab in the admin UI for the send log.

### Custom domain shows "404 Not Found"
- Vercel hasn't finished provisioning. Wait 5–10 minutes.
- DNS records aren't propagated. Check with `dig ra-syncbot.com`.
- You added the domain to Vercel but didn't add the DNS records at your registrar.

### iCal feed returns 401
The iCal endpoint uses `?token=<userId>` as auth (not the session cookie). Get your userId from the account menu → "Subscribe to calendar" link. Don't share this link — anyone with it can see your schedule.

---

## Updating the deployment

```bash
git pull
bun install        # if deps changed
bun run migrate    # run migrations to add new tables/columns (safe, idempotent)
bun run seed       # only if you need to wipe + reseed (usually you don't — destroys data)
git push           # Vercel auto-deploys on push to main
```

**Always run `bun run migrate` after pulling** if there are new tables or columns. The migration script is idempotent — safe to run multiple times. It uses `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN` with duplicate-column detection.

The migration script (`scripts/migrate.ts`) handles:
- Adding `emailNotifications` column to `User`
- Adding `ackStatus` + `acknowledgedAt` columns to `Assignment`
- Creating `Skill`, `EquipmentCatalog`, `EventEquipment`, `EquipmentClaim`, `Notification`, `EmailQueue` tables
- Adding a unique index on `EquipmentClaim(equipmentItemId, profileId)`
- Seeding the skill catalog from existing `Profile.skills` + `EventSkill` data

---

## Backup

Turso free tier doesn't include automated backups, but you can dump the DB at any time:

```bash
turso db shell ra-syncbot ".dump" > backup.sql
```

To restore:
```bash
turso db shell ra-syncbot < backup.sql
```

Recommended cadence: weekly during the active camp season.
