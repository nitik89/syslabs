# Deployment

SysLab runs on **Vercel** (the Next.js app and its one API route) with **Supabase** (database and sign-in). The app works without Supabase in guest mode.

## Vercel

The project is `syslab` on Vercel. Deploy from the repository root:

```bash
npx vercel deploy --prod
```

Vercel builds with `next build`: static pages (lessons, problems, the landing page) are prerendered and served from the edge; `POST /api/grade` runs as a serverless function.

### Environment variables

| Variable | Where it's used | Exposed to the browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser client, `/api/grade` | Yes (safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Browser client, verifying sign-ins in `/api/grade` | Yes (safe: row-level security protects data) |
| `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) | `/api/grade` only, to record verified scores | **No.** Server only, never prefixed with `NEXT_PUBLIC_` |

The Vercel Supabase integration sets these automatically. Without the secret key, `/api/grade` answers 503 and the app keeps working with local scores only. For local development, put the same values in `.env.local` (see `.env.example`).

## Supabase

### Database migrations

Run each file in `supabase/migrations/` once, in order, in the Supabase **SQL editor**:

| Migration | Adds |
| --- | --- |
| `0001_init.sql` | `profiles` (created on sign-up), `user_data` (each user's progress, designs and drafts), `shared_designs`, row-level security, and the `leaderboard` / `public_profile` functions |
| `0002_verified_scores.sql` | `verified_scores` (written only by the server), `record_verified_score`, and leaderboard/profile functions that count only verified results |

Until `0002` is run, `/api/grade` reports "not set up yet" and the leaderboard uses self-reported progress. After it's run, the leaderboard starts from verified results, so existing users need to submit again.

### Authentication

In **Authentication → URL Configuration**:

- **Site URL:** your production URL (for example `https://syslab-blond.vercel.app`).
- **Redirect URLs:** `https://your-domain/**`, plus `http://localhost:3000/**` for local testing.

If sign-in emails link to `localhost`, the Site URL is still the default.

Providers (Google, GitHub, email) and their callback URLs are described in [accounts-setup.md](accounts-setup.md).

### Emails

Supabase's built-in mailer only delivers to your project's team members and is rate-limited. For real users, add an SMTP provider (for example Resend) under **Authentication → Emails**, then paste the branded templates from `supabase/templates/` into **Authentication → Email Templates**:

| Template | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirmation.html` | Confirm your SysLab account |
| Magic Link | `magic_link.html` | Your SysLab sign-in link |
| Reset Password | `recovery.html` | Reset your SysLab password |
| Change Email Address | `email_change.html` | Confirm your new SysLab email |
| Invite user | `invite.html` | You're invited to SysLab |

## Checklist before a release

1. `npm run typecheck && npm run lint && npm test`
2. `npm run e2e` (builds and tests the production bundle)
3. `npx vercel deploy --prod`
4. Open the live site: landing page, a lesson, a problem (Run and Submit).
