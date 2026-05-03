/**
 * Playwright global setup — runs once before all tests.
 * Logs in as admin, saves:
 *  - .auth/admin.storageState.json  — Playwright storageState (cookies) for browser contexts
 *  - .auth/admin.json               — full auth data including user object
 */
import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_DIR = path.join(__dirname, '../.auth')
const AUTH_FILE = path.join(AUTH_DIR, 'admin.json')
const STORAGE_STATE_FILE = path.join(AUTH_DIR, 'admin.storageState.json')

const API_BASE = 'https://localhost:5001/api'

export default async function globalSetup() {
  // Ensure .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  const browser = await chromium.launch()
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const apiReq = context.request

  // Login via API — server sets the httpOnly access_token cookie
  const res = await apiReq.post(`${API_BASE}/auth/login`, {
    data: {
      email: 'admin@demopos.com',
      password: 'admin1234',
      rememberMe: false,
    },
  })

  const body = await res.json()
  if (!body.data?.user) {
    throw new Error(`Global setup login failed: ${JSON.stringify(body)}`)
  }

  const user = body.data.user

  // Get the storageState (cookies) from the context
  const storageState = await context.storageState()

  // Save storageState in the format Playwright expects for the storageState config option
  fs.writeFileSync(STORAGE_STATE_FILE, JSON.stringify(storageState, null, 2), 'utf-8')

  // Save the full auth data (including user object) for helpers to read
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ storageState, user }, null, 2), 'utf-8')

  await browser.close()

  console.log(`\n[global-setup] Admin session saved to ${AUTH_DIR}`)
}
