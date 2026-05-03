/**
 * Auth helpers for Playwright tests.
 *
 * Auth now uses httpOnly cookies (set by the server) rather than localStorage JWT.
 * The user object is still kept in localStorage for client-side permission checks.
 *
 * Session Strategy:
 * - global-setup.js logs in once and saves cookies + user to .auth/admin.json
 * - playwright.config.js loads that storageState for every test context automatically
 *   (so the cookie is already present when the browser opens)
 * - loginAsAdmin() just injects the user into localStorage; no API call needed
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '../../.auth/admin.json')

export const API_BASE = 'https://localhost:5001/api'
export const BASE_URL = 'https://localhost:3000'

export const ADMIN = {
  email: 'admin@demopos.com',
  password: 'admin1234',
}

/**
 * Read the saved admin user object from the global setup output.
 */
function getSavedUser() {
  const raw = fs.readFileSync(AUTH_FILE, 'utf-8')
  return JSON.parse(raw).user
}

/**
 * Inject user object into localStorage before the page loads.
 * Call this before page.goto() — uses addInitScript for reliability.
 * NOTE: The httpOnly cookie is already applied via storageState in playwright.config.js.
 */
export async function setAuthState(page, user) {
  await page.addInitScript((userData) => {
    localStorage.setItem('demopos_user', JSON.stringify(userData))
  }, user)
}

/**
 * Inject the saved admin session into the page's localStorage.
 * The cookie is already loaded from storageState in playwright.config.js —
 * this just adds the user object that PrivateRoute reads.
 *
 * Usage: await loginAsAdmin(request, page)
 *        (request is accepted for backward compat but not used)
 */
export async function loginAsAdmin(_request, page) {
  const user = getSavedUser()
  await setAuthState(page, user)
  return { user }
}

/**
 * Obtain a fresh session by calling the login API directly.
 * Only use this in tests that specifically test the login flow.
 * Returns { user } (no token — token is an httpOnly cookie).
 */
export async function loginViaAPI(request, email = ADMIN.email, password = ADMIN.password) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password, rememberMe: false },
    ignoreHTTPSErrors: true,
  })
  const body = await res.json()
  if (!body.data?.user) throw new Error(`Login failed: ${JSON.stringify(body)}`)
  return { user: body.data.user }
}
