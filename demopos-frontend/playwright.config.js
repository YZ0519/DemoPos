import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './tests/global-setup.js',

  use: {
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    // Load the saved cookie session (set by global-setup) for every test browser context.
    // This file contains { cookies: [...], origins: [] } in the Playwright storageState format.
    storageState: path.join(__dirname, '.auth/admin.storageState.json'),
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      // Use Chromium for mobile emulation (WebKit/Safari not installed)
      use: { ...devices['iPhone 12'], browserName: 'chromium' },
      testMatch: ['**/pos.spec.js', '**/auth.spec.js'],
    },
  ],
})
