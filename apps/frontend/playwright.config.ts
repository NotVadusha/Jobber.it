import { defineConfig, devices } from '@playwright/test'

const databaseUrl = process.env.E2E_DATABASE_URL

if (!databaseUrl) {
  throw new Error('E2E_DATABASE_URL is required')
}

const databaseName = new URL(databaseUrl).pathname.split('/').filter(Boolean).at(-1)

if (!databaseName?.endsWith('_e2e')) {
  throw new Error('E2E_DATABASE_URL must name a database ending in _e2e')
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'uv run --project ../backend jobber',
      url: 'http://127.0.0.1:3100/api/meta',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: databaseUrl,
        PINECONE_API_KEY: 'e2e-not-used',
        OPENAI_API_KEY: 'e2e-not-used',
        HOST: '127.0.0.1',
        PORT: '3100',
        LOG_LEVEL: 'DEBUG',
        RATE_LIMIT_MAX_SEARCHES: '0',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        API_PROXY_TARGET: 'http://127.0.0.1:3100',
      },
    },
    {
      command: 'uv run --project ../backend jobber',
      url: 'http://127.0.0.1:3101/api/meta',
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: databaseUrl,
        PINECONE_API_KEY: 'e2e-not-used',
        OPENAI_API_KEY: 'e2e-not-used',
        HOST: '127.0.0.1',
        PORT: '3101',
        LOG_LEVEL: 'DEBUG',
        RATE_LIMIT_MAX_SEARCHES: '3',
        RATE_LIMIT_WINDOW_SECONDS: '60',
      },
    },
  ],
})
