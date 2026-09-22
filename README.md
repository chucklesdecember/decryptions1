# Decryptions

React/Vite rebus game with Supabase Auth and a server-authoritative Supabase Postgres backend. Vercel serves the frontend; no separate API server or database is deployed.

## Repository layout

- `src/` — React app (components, `lib/` for Supabase/auth/game API clients, `data/image-credits.json` for clue-image provenance)
- `public/` — self-hosted clue images, referenced from puzzle rows as `/name.png`
- `supabase/` — SQL migrations and the [setup guide](supabase/README.md)
- `scripts/` — puzzle import/export and the bundle privacy check
- `tests/` — Node backend tests (embedded Postgres) and Playwright browser tests
- `docs/` — design references and attributions
- `.claude/skills/rebus-autogen/` — daily puzzle generator skill
- `private/` (git-ignored) — local puzzle JSON for `npm run import:puzzles`

## Local setup

Use Node 22+ and run these commands from the repository root:

```sh
npm ci
cp .env.example .env
npm run dev
```

Set the public Supabase URL and anon/publishable key in `.env`. Gameplay requires a configured, migrated Supabase project and a signed-in account. When the backend is unavailable, the app does not fall back to local scoring.

Follow [Supabase setup and deployment](supabase/README.md) before enabling play. New puzzle data must stay outside the public repository; only the server returns clues, validates words, and releases results.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run check:bundle
npx playwright install chromium
npm run test:browser
```

`npm test` creates an isolated temporary PostgreSQL database, applies the actual SQL migrations, and tests database roles and concurrent connections. The optional `embedded-postgres` platform package must be installed (do not use `--omit=optional`); allow its installation scripts so its bundled binaries work. It is a development dependency only, and never replaces Supabase in production. Tests bind to localhost, delete the temporary database on exit, and never read production credentials.

Browser tests use the same database behind a test-only Supabase HTTP/Auth adapter. JWT verification, hosted project grants, email delivery, and Turnstile still need the live staging checks documented in the setup guide. Playwright uses installed Chrome on macOS, or its downloaded Chromium elsewhere; `PLAYWRIGHT_CHANNEL` overrides that choice.
