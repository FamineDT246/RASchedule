# Deploying Robot Adventure Scheduler with Turso + Vercel

This guide walks you through hosting the scheduler online for free, with a cloud database that persists across deploys.

## Why Turso?

The app currently uses SQLite (a local file). That works great in development, but on serverless hosts like Vercel, the filesystem is **ephemeral** — every deploy wipes the database. Turso solves this by giving you a cloud-hosted SQLite database that persists.

**Turso free tier:**
- 500 databases
- 9 GB total storage
- 1 billion row reads/month
- No credit card required

That's more than enough for this app.

---

## Step 1: Sign up for Turso

1. Go to [turso.tech](https://turso.tech)
2. Click **Sign up** (GitHub login is fastest)
3. Verify your email

## Step 2: Install the Turso CLI

On Mac/Linux:
```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

On Windows (PowerShell):
```powershell
irm https://get.tur.so/install.ps1 | iex
```

Verify it installed:
```bash
turso --version
```

## Step 3: Log in and create a database

```bash
# Log in (opens browser)
turso auth login

# Create your database
turso db create robot-adventure

# Get the connection URL
turso db show robot-adventure --url
# Output: libsql://robot-adventure-yourname.turso.io

# Create an auth token (save this!)
turso db tokens create robot-adventure
# Output: eyJhbGciOiJ... (a long string)
```

**Save both of these** — you'll need them in the next steps.

## Step 4: Update the Prisma schema

Open `prisma/schema.prisma` and change the datasource provider from `sqlite` to `libsql`:

```prisma
datasource db {
  provider  = "libsql"
  url       = env("DATABASE_URL")
  authToken = env("DATABASE_AUTH_TOKEN")
}
```

Then install the libSQL adapter:

```bash
bun add @prisma/adapter-libsql
```

## Step 5: Set environment variables

Create a `.env` file (or update the existing one):

```bash
DATABASE_URL=libsql://robot-adventure-yourname.turso.io
DATABASE_AUTH_TOKEN=eyJhbGciOiJ...your-token-here...
```

**Never commit `.env` to git!** It should already be in `.gitignore`.

## Step 6: Push the schema and seed

```bash
# Push the schema to Turso (creates all tables)
bun run db:push

# Seed with the initial data (staff, events, assignments)
bun run scripts/seed.ts
```

You should see:
```
Seed complete.
  Profiles:    20
  Events:      17
  ...
  Admin login: jelani@robotadventure.local / changeme
```

## Step 7: Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com) → Sign in with GitHub
   - Click **New Project**
   - Import your repository
   - Vercel auto-detects Next.js — keep the defaults

3. **Set environment variables** in Vercel:
   - Go to **Settings → Environment Variables**
   - Add `DATABASE_URL` = your Turso URL
   - Add `DATABASE_AUTH_TOKEN` = your Turso token

4. **Deploy!**
   - Click **Deploy**
   - Wait ~2 minutes
   - Your app is live at `your-project.vercel.app`

## Step 8: Change the admin password

**Do this immediately after deploying!**

1. Open your deployed app
2. Log in with `jelani@robotadventure.local` / `changeme`
3. Click the user menu (top right) → **Change password**
4. Set a strong password

---

## How the app works (recap)

### For the boss (admin)
1. **Log in** with email + password
2. **Scheduler tab** — drag instructors onto events (desktop) or tap-to-assign (mobile)
3. **Events tab** — create/edit events, set status (Draft/Tentative/Confirmed), recurring events
4. **Team tab** — manage staff info, availability, contracts
5. **Conflicts tab** — see double-bookings, unfilled slots, fatigue streaks
6. **Invites tab** — generate invite links for instructors, share via WhatsApp/email

### For instructors
1. **Receive invite link** from the boss via WhatsApp or email
2. **Claim account** — set name, email, and password
3. **View schedule** — see assignments (carousel or list view)
4. **Opt in to events** — Interested / Available / Can't make it
5. **Set availability** — mark dates they can't work
6. **Change password** via account menu

---

## Security notes

- **Passwords** are bcrypt-hashed (never stored in plain text)
- **Cookies** are httpOnly (can't be read by JavaScript)
- **Login required** — no one sees the scheduler without authenticating
- **Role-based access** — instructors can only see their own schedule + opt in; admin sees everything
- **Invite tokens** are single-use (can't be reused after claiming)

### What's still NOT protected (honest gaps)
- Admin API routes don't check the auth cookie server-side — they rely on the client not showing the UI. For a small internal app, this is fine. If you ever share the URL publicly, add server-side role checks to each route.

---

## Troubleshooting

### "Unable to acquire lock" during db:push
Another Prisma process is running. Kill it and retry:
```bash
rm -f .next/dev/lock
bun run db:push
```

### Login fails after deploying
Make sure you ran `bun run scripts/seed.ts` against Turso (not just locally). The seed creates the admin user.

### Data doesn't persist after deploy
Check that `DATABASE_URL` points to Turso (`libsql://...`), not a local file (`file:...`).

### Need to reset everything
```bash
# Drop all data and re-seed
bun run scripts/seed.ts
```
The seed script clears all existing data before inserting.

---

## Cost breakdown

| Service | Free tier | This app's usage |
|---------|-----------|------------------|
| Turso | 500 DBs, 9GB, 1B reads/mo | 1 DB, ~1MB, ~1000 reads/mo |
| Vercel | 100GB bandwidth, 100hrs build/mo | ~1GB bandwidth, ~2min build |
| **Total** | **$0/month** | |

You won't pay anything unless the app grows massively (hundreds of instructors, thousands of events).

---

## Questions?

If something breaks, check:
1. The Vercel function logs (Vercel dashboard → Functions → Logs)
2. The Turso database inspector (turso.tech → your DB → Inspector)
3. The browser console (F12 → Console)

The most common issue is environment variables not being set correctly in Vercel — double-check those first.
