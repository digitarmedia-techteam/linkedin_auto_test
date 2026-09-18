import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { existsSync } from 'fs';

const headless = (process.env['HEADLESS'] ?? 'false').toLowerCase() === 'true';
const timeout = parseInt(process.env['DEFAULT_TIMEOUT'] ?? '30000', 10);
const baseUrl = process.env['APP_BASE_URL'] ?? 'http://localhost:3000';
const authStatePath = 'storage/auth.json';
const authStateExists = existsSync(authStatePath);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 1,
  timeout,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'reports/test-results.json' }],
  ],

  use: {
    baseURL: baseUrl,
    headless,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Setup project — saves auth state before tests run
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      timeout: 180_000,
      use: authStateExists ? { storageState: authStatePath } : {},
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storage/auth.json',
      },
      dependencies: process.env['SKIP_AUTH'] ? [] : ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'storage/auth.json',
      },
      dependencies: process.env['SKIP_AUTH'] ? [] : ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'storage/auth.json',
      },
      dependencies: process.env['SKIP_AUTH'] ? [] : ['setup'],
    },
  ],
});
