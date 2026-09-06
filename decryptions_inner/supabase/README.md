# Supabase setup for accounts

The app uses Supabase Auth (email + password). A player's **username** is public on the
leaderboard; their **email** lives in a private `profiles` table that only they can read. Solved puzzles are stored in `progress` and synced to every device they log in on.

Do these steps once, in order.

## 1. Run the migration

Dashboard → **SQL Editor** → paste and run [`2026-09-05-accounts.sql`](./2026-09-05-accounts.sql).
It is safe to run more than once. (The older `add-hints-used-column.sql` has already been applied.)

## 2. Remove the old anonymous insert policy on `solves`

Dashboard → **Database → Policies → `solves`**. Delete any policy that lets `anon` / `public`
**INSERT** rows. Keep (or add) a SELECT policy for everyone; the migration created
`solves: public read` and `solves: insert own`.

## 3. Email settings

Dashboard → **Authentication → Sign In / Providers → Email**:

- **Turn off "Confirm email".** Supabase's built-in mailer only sends **2 emails per hour**, so
  with confirmation on, sign-ups stall after the second player. Sign-up then logs the player
  in immediately.
- Set **Minimum password length** to 8 (the app enforces 8 too).

Optional, later: configure a custom SMTP provider (Dashboard → Project Settings →
Authentication → SMTP; e.g. Resend's free tier) and turn confirmation back on. Password-reset
emails also use this mailer, so until then only a couple of resets per hour will go out.

## 4. URLs (needed for password-reset links)

Dashboard → **Authentication → URL Configuration**:

- Site URL: `https://decryptions1.vercel.app`
- Redirect URLs: add `http://localhost:3000` and your Vercel preview domain pattern
  (e.g. `https://*-chucklesdecember.vercel.app`).

## 5. Cloudflare Turnstile (bot protection on the login form)

1. In Cloudflare → **Turnstile** → Add widget. Hostnames: `decryptions1.vercel.app` and
   `localhost`. Widget mode: Managed (or Invisible).
2. Copy the **Site key** into the app's environment as `VITE_TURNSTILE_SITE_KEY`
   (Vercel → Project → Settings → Environment Variables, and your local `.env`).
3. Copy the **Secret key** into Dashboard → **Authentication → Attack Protection →
   Enable CAPTCHA protection** → provider **Turnstile**.

Until both halves are configured the app simply hides the widget and Supabase does not
require a token. Once the secret is saved in Supabase, sign-ups without a site key in the
app will fail, so do steps 2 and 3 together.

## 6. Rate limits (optional hardening)

Dashboard → **Authentication → Rate Limits**. Defaults are fine for launch; if sign-up spam
appears, lower "Rate limit for sign ups and sign ins" (per IP, per 5 minutes).

## 7. Redeploy

Add `VITE_TURNSTILE_SITE_KEY` in Vercel, then redeploy so the new build picks it up.

## What the tables mean

| Table | Who can read | Purpose |
|---|---|---|
| `profiles` | owner only | `username` (public via leaderboard), `email` (private) |
| `progress` | owner only | one row per solved puzzle per account: time, hints, leaderboard row id |
| `solves` | everyone | leaderboard rows; `user_id` links them to an account, `display_name` is stamped from the profile by a trigger |

RPC functions: `username_status(name)` (availability check before sign-up) and
`claim_solves(ids)` (attaches a device's pre-account leaderboard rows to the new account).
