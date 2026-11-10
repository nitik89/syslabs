# Accounts, cloud sync and community features (Supabase)

Without these steps SysLab runs in guest mode: everything is stored in the browser and the sign-in,
share, leaderboard and profile features are hidden. Setup takes about 15 minutes.

## 1. Create the project

1. Create a free project at <https://supabase.com/dashboard>.
2. Open **SQL Editor**, paste all of `supabase/migrations/0001_init.sql`, and run it.
   It creates `profiles`, `user_data`, `shared_designs`, the row-level security policies, and the
   `leaderboard` / `public_profile` functions.

## 2. Environment variables

From **Project Settings → API**, copy the project URL and the publishable (or legacy anon) key.

- Local: copy `.env.example` to `.env.local` and fill both values, then restart `npm run dev`.
- Vercel: `vercel env add NEXT_PUBLIC_SUPABASE_URL` and `vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (Production and Preview), then redeploy.

Never put the `service_role` / secret key in the app; it isn't needed.

## 3. Auth settings (Authentication → URL Configuration)

- **Site URL:** `https://syslab-blond.vercel.app`
- **Redirect URLs:** `https://syslab-blond.vercel.app/**` and `http://localhost:3001/**`

Email + password and magic links work out of the box (Authentication → Providers → Email). Supabase's
built-in mailer is rate-limited; add custom SMTP under Authentication → Emails before real launch.

## 4. Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Paste the client ID and secret into Supabase → Authentication → Providers → Google, and enable it.

## 5. GitHub sign-in

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Homepage URL: your site. Authorization callback URL: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. Paste the client ID and a new client secret into Supabase → Authentication → Providers → GitHub, and enable it.

## How data flows

- Guests: `localStorage` (unchanged).
- Signed in: the same keys (`progress`, `designs`, `draft:*`) live in `user_data`, one row per key,
  readable and writable only by their owner.
- First sign-in on a browser: that browser's guest progress and designs are merged into the account
  (best score per problem, union of designs and active days).
- Public: `profiles` rows with `is_public = true`, totals from the `leaderboard` / `public_profile`
  functions (XP, solved count, solved problem ids, active days), and `shared_designs` snapshots.

## Branded emails and the localhost link

Auth emails link to whatever **Site URL** is set in Supabase when the app's redirect isn't on the allow list.
If emails point at `localhost`, fix the URL configuration first.

1. **Authentication → URL Configuration**
   - Site URL: `https://syslab-blond.vercel.app`
   - Redirect URLs: `https://syslab-blond.vercel.app/**` (add `http://localhost:3000/**` for local testing)
2. **Authentication → Email Templates**: paste each file from `supabase/templates/` and set its subject:

| Template | File | Subject |
|---|---|---|
| Confirm signup | `confirmation.html` | Confirm your SysLab account |
| Magic Link | `magic_link.html` | Your SysLab sign-in link |
| Reset Password | `recovery.html` | Reset your SysLab password |
| Change Email Address | `email_change.html` | Confirm your new SysLab email |
| Invite user | `invite.html` | You're invited to SysLab |

Emails already sent keep their old link: request a new one after changing the settings.
