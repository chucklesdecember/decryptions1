
  # Rebus Puzzle News Game

  This is a code bundle for Rebus Puzzle News Game. The original project is available at https://www.figma.com/design/T1RkrH6NMY7ZpqWfhLWGYR/Rebus-Puzzle-News-Game.

  ## Running the code

  Run `npm i` to install the dependencies.

  Copy `.env.example` to `.env` and fill in the Supabase keys (see below). Without them the game
  still runs, but accounts and the leaderboard are disabled.

  Run `npm run dev` to start the development server.

  ## Accounts, progress sync and leaderboard

  Players log in with email + password (Supabase Auth). Their username is public on the
  leaderboard; their email stays private. Solved puzzles are saved to the account and synced to
  every device they log in on, and times are posted to the leaderboard automatically.

  Environment variables (`.env` locally, Project Settings → Environment Variables on Vercel):

  | Variable | Purpose |
  |---|---|
  | `VITE_SUPABASE_URL` | Supabase project URL |
  | `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
  | `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the login form (optional; widget hidden when empty) |
  | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | Optional analytics |

  One-time Supabase setup (SQL migration + dashboard settings): see [`supabase/README.md`](./supabase/README.md).
