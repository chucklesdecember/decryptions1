import { test, expect } from '@playwright/test';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createDatabase, ids, rpc } from './database.mjs';
let db;
test.beforeAll(async () => {
  db = await createDatabase();
  await mkdir('private', { recursive: true });
  await writeFile('private/browser-test-canary.json', JSON.stringify({ answer: 'PRIVATE_BOUNDARY_CANARY' }), { flag: 'wx' });
});
test.afterAll(async () => { await db?.stop(); await unlink('private/browser-test-canary.json'); });

async function player(browser, userId = ids.alice, loggedIn = true, returningDevice = true) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const client = await db.clientFor(userId), anon = await db.clientFor(null, 'anon');
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', is_anonymous: false, user_metadata: {}, app_metadata: {}, created_at: '2000-01-01T00:00:00Z' };
  const guestUser = { ...user, email: '', is_anonymous: true };
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test-signature`;
  const session = { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
  const guestSession = { ...session, user: guestUser };
  // Test-only Auth/HTTP adapter; SQL and RLS run unmodified against PostgreSQL.
  // The real Supabase gateway is responsible for JWT verification in production.
  if (loggedIn) await context.addInitScript(s => localStorage.setItem('sb-test-auth-token', JSON.stringify(s)), session);
  else if (returningDevice) await context.addInitScript(() => localStorage.setItem('decryptions_account_used', '1'));
  const behavior = { loseNextWordResponse: false, delayNextWord: false };
  const responses = [];
  await context.route('https://test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const name = url.pathname.split('/').at(-1);
    let body;
    try {
      if (url.pathname.includes('/rpc/')) {
        const p = request.postDataJSON() ?? {};
        const args = name === 'submit_word' ? [p.p_puzzle_id, p.p_word_index, p.p_guess] : name === 'reveal_hint' ? [p.p_puzzle_id, p.p_word_index] : ['start_puzzle', 'pause_puzzle', 'get_leaderboard'].includes(name) ? [p.p_puzzle_id] : [];
        body = name === 'username_status' ? 'available' : name === 'login_email_for_identifier' ? 'test@example.com' : await rpc(request.headers().authorization === 'Bearer test-anon-key' ? anon : client, name, args);
        responses.push({ name, body, params: p });
        if (name === 'submit_word' && behavior.loseNextWordResponse) { behavior.loseNextWordResponse = false; return route.abort(); }
        if (name === 'submit_word' && behavior.delayNextWord) { behavior.delayNextWord = false; await new Promise(r => setTimeout(r, 600)); }
      } else if (name === 'profiles') {
        body = (await client.query('select * from public.profiles')).rows;
      } else if (name === 'logout') { body = {}; }
      else if (name === 'signup') { body = guestSession; }
      else if (name === 'user' && request.method() === 'PUT') {
        const input = request.postDataJSON() ?? {};
        body = { user: { ...guestUser, new_email: input.email } };
      }
      else if (name === 'user') { body = user; }
      else if (name === 'token') { body = session; }
      else return route.fulfill({ status: 404, json: { message: 'Unexpected test request' } });
      await route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    } catch (err) { await route.fulfill({ status: 400, json: { code: err.code, message: err.message } }); }
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  return { context, page, behavior, responses };
}

test('daily play resists local score/clock edits, resumes across devices, and retries a lost completion response', async ({ browser }) => {
  const a = await player(browser);
  try {
    await a.page.evaluate(id => {
      localStorage.setItem(`decryptions_solved_${id}`, '1');
      localStorage.setItem(`decryptions_solve_seconds_${id}`, '0');
      localStorage.setItem(`decryptions_account_progress_v2_${id}`, JSON.stringify([{ verified: true, timeSeconds: 0 }]));
    }, ids.daily);
    expect(a.responses.filter(r => r.name === 'list_puzzles')[0].body[0]).toEqual({ id: ids.daily, date: '2000-01-02', category: 'Test' });
    expect(a.responses.some(r => r.name === 'start_puzzle')).toBe(false);
    await a.page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(a.page.getByRole('textbox', { name: 'Word 1', exact: true })).toBeVisible();
    await expect(a.page.getByRole('heading', { name: 'Hidden News', exact: true })).toHaveCount(0);
    expect(a.responses.find(r => r.name === 'start_puzzle').body.words.every(w => w.acceptedAnswer === null && w.hint === null)).toBe(true);
    await a.page.evaluate(() => { Date.now = () => 0; });
    await db.admin.query("update private.attempts set started_at = clock_timestamp() - interval '120 seconds' where user_id = $1", [ids.alice]);
    a.behavior.delayNextWord = true;
    await a.page.getByRole('textbox', { name: 'Word 1', exact: true }).fill('XXXXXX');
    await expect.poll(() => a.responses.some(r => r.name === 'submit_word')).toBe(true);
    await a.page.getByRole('textbox', { name: 'Word 1', exact: true }).fill('hidden');
    await expect(a.page.getByRole('textbox', { name: 'Word 1', exact: true })).toBeDisabled();
    await a.page.getByRole('button', { name: 'Show hint', exact: true }).nth(1).click();
    await expect(a.page.getByText('Second private hint', { exact: true })).toBeVisible();
    await a.page.keyboard.press('Escape');
    await a.page.getByRole('button', { name: 'Pause puzzle', exact: true }).click();
    await expect(a.page.getByRole('heading', { name: 'Puzzle paused' })).toBeVisible();
    await expect(a.page.getByText('Your timer is stopped.', { exact: true })).toBeVisible();
    await expect(a.page.getByLabel('Elapsed time')).toContainText('2:');
    await a.page.getByRole('button', { name: 'Decryptions', exact: true }).click();
    await expect(a.page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await a.page.reload();
    await a.page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(a.page.getByRole('textbox', { name: 'Word 1', exact: true })).toHaveValue('HIDDEN');
    await expect(a.page.getByLabel('Elapsed time')).toContainText('2:');
    const b = await player(browser);
    try {
      await b.page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(b.page.getByRole('textbox', { name: 'Word 1', exact: true })).toHaveValue('HIDDEN');
      b.behavior.loseNextWordResponse = true;
      await b.page.getByRole('textbox', { name: 'Word 2', exact: true }).fill('NEWS');
      await expect(b.page.getByRole('button', { name: 'Retry word 2', exact: true })).toBeVisible();
      await expect(b.page.getByRole('heading', { name: 'Hidden News', exact: true })).toHaveCount(0);
      await b.page.getByRole('button', { name: 'Retry word 2', exact: true }).click();
      await expect(b.page.getByRole('dialog')).toBeVisible();
      await expect(b.page.getByText('Using 1 hint', { exact: true })).toBeVisible();
      await b.page.keyboard.press('Escape');
      await expect(b.page.getByRole('heading', { name: 'Hidden News', exact: true })).toBeVisible();
      await expect(b.page.getByRole('link', { name: 'Read article', exact: true })).toHaveAttribute('href', 'https://example.com/private-headline');
      const result = (await db.admin.query('select * from public.solves where user_id=$1', [ids.alice])).rows;
      expect(result).toHaveLength(1); expect(result[0].verified).toBe(true); expect(result[0].time_seconds).toBeGreaterThanOrEqual(120);
      // Completed games now show the full leaderboard immediately rather than
      // requiring a separate leaderboard button.
      await expect(b.page.getByRole('heading', { name: 'Leaderboard', exact: true })).toBeVisible();
      await expect(b.page.getByText('Unverified', { exact: true })).toHaveCount(2);
      await b.page.screenshot({ path: '/tmp/decryptions-solved-mobile.png', fullPage: true });
      expect(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await b.page.getByRole('button', { name: 'Account menu for alice' }).click();
      await b.page.getByRole('menuitem', { name: 'Sign out' }).click();
      await expect(b.page.getByRole('heading', { name: 'Hidden News', exact: true })).toHaveCount(0);
    } finally { await b.context.close(); }
  } finally { await a.context.close(); }
});

test('archive does not start until Play, uses server validation, and legacy results stay unverified', async ({ browser }) => {
  const p = await player(browser, ids.bob);
  try {
    await p.page.getByRole('button', { name: 'Archive', exact: true }).click();
    await p.page.getByRole('button', { name: 'January 1, 2000 Test' }).click();
    expect(p.responses.some(r => r.name === 'start_puzzle')).toBe(false);
    await p.page.getByRole('button', { name: 'Play puzzle', exact: true }).click();
    await p.page.getByRole('textbox', { name: 'Word 1', exact: true }).fill('PRIVATE');
    await expect(p.page.getByRole('textbox', { name: 'Word 1', exact: true })).toBeDisabled();
    await p.page.getByRole('textbox', { name: 'Word 2', exact: true }).fill('STORY');
    await expect(p.page.getByRole('dialog')).toBeVisible();
    expect((await db.admin.query('select verified from public.solves where user_id=$1 and puzzle_id=$2', [ids.bob, ids.archive])).rows[0].verified).toBe(true);
  } finally { await p.context.close(); }
  const legacy = await player(browser, ids.legacy);
  try {
    await legacy.page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(legacy.page.getByText('Unverified · recorded before server validation.')).toBeVisible();
    await expect(legacy.page.getByRole('textbox', { name: 'Word 1', exact: true })).toBeDisabled();
    expect(legacy.responses.some(r => r.name === 'submit_word')).toBe(false);
  } finally { await legacy.context.close(); }
});

test('guest-first play and password accounts work without legacy account lookup', async ({ browser, request }) => {
  for (const path of ['/private/browser-test-canary.json', '/supabase/2026-09-06-authoritative-game.sql', '/scripts/import-puzzles.mjs']) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain('PRIVATE_BOUNDARY_CANARY');
  }
  const p = await player(browser, ids.cloud, false);
  try {
    await p.page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(p.page.getByRole('heading', { name: 'Unlock the archive' })).toBeVisible();
    await expect(p.page.getByText('No past puzzles are available yet.')).toHaveCount(0);
    await p.page.getByRole('button', { name: 'Back', exact: true }).click();
    await p.page.getByRole('button', { name: 'Log in or create account', exact: true }).click();
    await expect(p.page.getByRole('dialog')).toBeVisible();
    expect(p.responses.some(r => r.name === 'start_puzzle')).toBe(false);
    await p.page.getByRole('textbox', { name: 'Email', exact: true }).fill('test@example.com');
    await p.page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
    await p.page.getByRole('button', { name: 'Log in', exact: true }).last().click();
    await expect(p.page.getByRole('button', { name: 'Account menu for cloud' })).toBeVisible();
  } finally { await p.context.close(); }

  const signup = await player(browser, ids.bob, false, false);
  try {
    await signup.page.getByRole('button', { name: 'Log in or create account', exact: true }).click();
    await signup.page.getByRole('tab', { name: 'Create account', exact: true }).click();
    await signup.page.getByRole('textbox', { name: 'Email', exact: true }).fill('new@example.com');
    await signup.page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
    await signup.page.getByRole('button', { name: 'Create account', exact: true }).last().click();
    await expect(signup.page.getByRole('textbox', { name: 'Word 1', exact: true })).toBeVisible();
    expect(signup.responses.some(r => r.name === 'start_puzzle')).toBe(true);
  } finally { await signup.context.close(); }

  const guest = await player(browser, ids.bob, false, false);
  try {
    await guest.page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(guest.page.getByRole('heading', { name: 'Choose a username' })).toBeVisible();
    await guest.page.getByRole('textbox', { name: 'Username' }).fill('bob');
    await guest.page.getByRole('button', { name: 'Start playing' }).click();
    await expect(guest.page.getByRole('heading', { name: 'How to play' })).toBeVisible();
    await guest.page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(guest.page.getByRole('textbox', { name: 'Word 1', exact: true })).toBeVisible();
    await guest.page.getByRole('button', { name: 'Log in or create account', exact: true }).click();
    await guest.page.getByRole('textbox', { name: 'Email', exact: true }).fill('guest@example.com');
    await guest.page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
    await guest.page.getByRole('button', { name: 'Create account', exact: true }).last().click();
    await expect(guest.page.getByText('Account created. You can play now.')).toBeVisible();
  } finally { await guest.context.close(); }
});
