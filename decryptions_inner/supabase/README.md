# Supabase backend and deployment

Supabase provides **Postgres, Auth, and the Data API**. The browser calls Postgres functions through `supabase.rpc()` with its Auth session. There is no separate production Node server, custom JWT issuer, or extra database. Only public Supabase configuration belongs in Vite/Vercel environment variables.

## Deploy in order

This change builds on account PR #5. Test in a separate Supabase staging project first. Take a database backup before the production cutover. Do not reopen gameplay between the migration and the private content import: old clients will lose score-write access as soon as the backend migration runs.

1. For an empty project, apply `000-initial-solves.sql`. Existing projects already have this table. Apply `add-hints-used-column.sql` if the column is missing.
2. Apply `2026-09-05-accounts.sql` if the account migration has not been applied.
3. Apply `2026-09-06-authoritative-game.sql` using the Supabase SQL Editor or your migration runner. This migration is transactional and repeatable; it removes all old `solves`/`progress` policies, revokes direct client table access, and removes `claim_solves`. **Do not rerun the older accounts migration afterward.**
4. Apply `2026-09-20-passwordless-auth.sql` to keep private profile emails synchronized.
5. Apply `2026-09-21-guest-archive.sql`, then `2026-09-21-pausable-timer.sql`.
6. Apply `2026-09-21-remove-september-15.sql` on projects that previously imported the retired September 15 puzzle.
7. Apply `2026-09-21-password-auth.sql`, then `2026-09-21-email-derived-usernames.sql` for username-or-email password login and email-derived names.
8. Apply `2026-09-23-answer-aliases.sql` to allow optional server-private alternate spellings such as `19` / `NINETEEN`.
9. Import the private puzzle data as described below, using the same project's Postgres admin connection. Confirm `list_puzzles()` returns the expected dates and UUIDs. The most recent published date is the daily puzzle; older dates form the archive. Publication uses `America/New_York`, and future puzzles are inaccessible.
10. Deploy this frontend to Vercel with that project's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Keep `.env`, database passwords, and service-role keys out of Git and out of all `VITE_` variables. Leave the `private` schema out of the Data API's exposed schemas.
11. Complete the staging checks below before applying the same steps to production. Monitor Supabase Postgres/API logs for permission errors, failed RPCs, and unusual submission volume. The client does not log guesses or answer responses.

Rollback: retain the database restrictions and take the game offline while correcting the frontend or migration. Restoring the old frontend alone cannot submit scores. Do not restore permissive grants/policies as a workaround.

## Private puzzle import

For the **11 retained already-public historical puzzles**, excluding the retired September 15, 2026 puzzle, generate an ignored local seed from the pinned historical revision on main:

```sh
npm run export:legacy
```

It writes `private/puzzles.json` with file permissions `0600` and refuses to overwrite it. The exporter exists only to migrate already-published content. Git history and old deployed assets still contain those historical answers; removing the current source does not erase them. Retire old previews/assets where practical. Do not commit future answers or SQL literals containing them to this public repository.

Author future puzzles directly in private JSON outside Git. Each entry has a unique opaque UUID `id`, ISO `date`, `category`, `headline`, optional HTTP(S) `articleUrl`, `words` containing `answer`, optional `acceptedAnswers`, and `clues`, and one hint string per word. `acceptedAnswers` is a nonempty array of unique case-insensitive aliases distinct from the canonical answer; it remains private and a successful alias still reveals the canonical answer. Clues contain `type` (`image`, `text`, `symbol`, `operator`), `content`, and optional `alt`. For image clues, `content` is a local asset path or HTTP(S) URL. Public clue assets should use neutral names and contain only the intended clues. Each puzzle contains 1–30 words; each answer or alias contains 1–128 characters. Do not add solution-bearing metadata to clues.

Store the **Supabase database connection string** in a private environment file outside the repository, or an ignored `private/import.env` with permissions `0600`:

```text
PUZZLE_DATABASE_URL=postgresql://...supabase-database-connection...
```

Then import (Node 22+):

```sh
node --env-file=private/import.env scripts/import-puzzles.mjs private/puzzles.json
```

Use the connection string from Supabase's Connect dialog: direct Postgres or the session pooler, with its TLS settings. This is an administrative tool; it uses the database connection, not the anon key or a browser-exposed service key. Never pass the password in command arguments. It imports all entries in one transaction, rejects invalid input, and rejects content changes after any attempt or completion. Maintain stable UUIDs when reimporting. The optional `legacyId` is only for historical migration; its mapping lives in a private table.

The importer preserves old scores, timestamps, hints, names, and ownership, replacing legacy puzzle slugs with UUIDs. Account-linked leaderboard rows become the retained completion if old progress disagrees. Cloud-only progress stays completed without gaining a leaderboard row. Anonymous rows stay ranked but cannot be claimed. Unmapped historical rows remain stored and inaccessible through the RPCs until their puzzle is imported. Identity conflicts abort the entire import; resolve them from the backup rather than deleting scores silently.

## RPC contract and security

| Function | Access | Behavior |
|---|---|---|
| `list_puzzles()` | Public | Published UUIDs, dates, categories only; newest first |
| `get_leaderboard(p_puzzle_id uuid)` | Public | Top 100: time, hints, timestamp, then row UUID; old scores labeled `verified: false`; no account IDs |
| `start_puzzle(p_puzzle_id uuid)` | Signed in | Create/resume the one account attempt before returning clues and lengths; completed accounts receive their saved result |
| `pause_puzzle(p_puzzle_id uuid)` | Signed in | Pause the active attempt and return its frozen elapsed time |
| `submit_word(p_puzzle_id uuid, p_word_index integer, p_guess text)` | Signed in | Zero-based word index, case-insensitive match against the canonical answer or private aliases; final accepted word atomically writes score and progress |
| `reveal_hint(p_puzzle_id uuid, p_word_index integer)` | Signed in | Record each hint once, then return its text |
| `get_my_progress()` | Signed in | Read only the caller's completed, published puzzles |

`start_puzzle` and `reveal_hint` return `GameState`; submissions return `{ state, correct }` or `{ retryAfterSeconds }`. Word responses reveal only already-accepted answers and already-revealed hints. Headline and article URL appear only in completed results. There is no API accepting a score, owner, completion timestamp, or hint count.

The database derives ownership from `auth.uid()`, serializes changes with row locks, and enforces unique account/puzzle keys. Time is whole elapsed seconds measured by the database. Explicit pauses and in-app navigation exclude paused time; closing the browser without pausing does not. There is no attempt-reset endpoint. Sixty word checks per account per fixed one-minute window are shared across all puzzles; hints and resume still work when checks are limited. Client storage is an optional account cache and is never imported as evidence of a solve.

Legacy scores remain ranked and unverified, including potentially forged historical times. One account can finish each puzzle once; the system does not prevent multiple accounts or outside assistance.

## Account settings

Accounts use an email and password. A new account's public username is automatically the portion of its email before `@`; it is never entered manually. Existing players retain their historic usernames. Enable **Anonymous Sign-Ins** and **Email** in Supabase Auth, and disable **Confirm email** so account creation signs the player in immediately. The signup email is intentionally unverified and is used for password resets and Decryptions announcements. Returning players may sign in with either their username or email plus password; the small security-definer lookup in `2026-09-21-password-auth.sql` maps a username to its account email before Supabase performs password verification. Configure the Site URL and allowed redirect URLs for production, staging, and local origins so password-reset links return to the app.

Anonymous users are upgraded in place with `updateUser({ email, password })`, preserving their progress and scores. Anonymous users use the `authenticated` database role, which is intentional here because newly created players may begin immediately.

For Turnstile, set the public `VITE_TURNSTILE_SITE_KEY` in Vercel and the corresponding secret in Supabase Authentication's CAPTCHA/attack-protection settings. Configure both together and include the correct widget hostnames. Auth form tokens reset after attempts and tab switches.

## Staging acceptance

Use the real Supabase anon key and two real accounts, in separate browser profiles:

- A signed-out visitor can see dates and rankings, but cannot start, check words, obtain hints, read private tables, or read/write `solves`/`progress` directly. Verify old clients and `claim_solves` fail as well.
- Start before clues arrive; confirm start/resume timestamps do not reset on reload, navigation, hide/show, or another device. A forged localStorage completion and altered browser clock cannot produce a saved score.
- Check a wrong and correct word, retry a repeated hint, and finish from simultaneous tabs. Confirm one verified leaderboard row and one completion with database-calculated time. Network failure after completion must recover the same row.
- Account A's accepted words, hints, and results must not appear for account B, including when switching accounts while requests are in flight. Invalid/expired JWTs must be rejected by Supabase's gateway.
- Both daily and archive play use the same flow. Future puzzles are absent. Unsolved payloads and built assets contain no answers, headlines, article links, unrevealed hints, or legacy slugs.
- Imported anonymous scores remain ranked/unclaimable. Account-linked legacy solves stay completed with original times and an Unverified label; cloud-only completions do not gain scores.
- Verify immediate play after sign-up, username and email password login on another device, password reset, CAPTCHA retries, progress reload, and sign-out against hosted Auth.
