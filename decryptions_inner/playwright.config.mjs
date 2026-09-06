import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', workers: 1,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://127.0.0.1:43177', channel: process.env.PLAYWRIGHT_CHANNEL || (existsSync('/Applications/Google Chrome.app') ? 'chrome' : undefined), trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 43177 --strictPort',
    url: 'http://127.0.0.1:43177', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-anon-key', VITE_TURNSTILE_SITE_KEY: '', VITE_POSTHOG_KEY: '' },
  },
});
