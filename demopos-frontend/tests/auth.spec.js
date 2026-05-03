import { test, expect } from '@playwright/test'
import { ADMIN, loginAsAdmin } from './helpers/auth.js'

// Auth tests interact with public pages (login/register).
// These tests DON'T inject the demopos_user into localStorage,
// so the app renders the unauthenticated state (login/register pages).
// The httpOnly cookie from storageState is still present but has no effect
// for the login page since PrivateRoute checks localStorage user, not cookies.
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear demopos_user so the app thinks we're unauthenticated
    await page.addInitScript(() => {
      localStorage.removeItem('demopos_user')
    })
    await page.goto('/login', { waitUntil: 'commit' })
  })

  test('login page renders correctly', async ({ page }) => {
    // Wait for React lazy chunk to load and render
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
    await expect(page.getByText('Sign up')).toBeVisible()
  })

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 15_000 })
    await page.getByPlaceholder('you@example.com').fill(ADMIN.email)
    await page.getByPlaceholder('••••••••').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('login with wrong password shows error toast', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 15_000 })
    await page.getByPlaceholder('you@example.com').fill(ADMIN.email)
    await page.getByPlaceholder('••••••••').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    // Toast error should appear
    await expect(
      page.locator('[role="status"]')
        .or(page.locator('.react-hot-toast'))
        .or(page.getByText(/invalid|incorrect|failed/i))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('login with empty fields shows validation error', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText(/required/i)).toBeVisible({ timeout: 5_000 })
  })

  test('password visibility toggle works', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('••••••••')
    await expect(passwordInput).toBeVisible({ timeout: 15_000 })
    await passwordInput.fill('testpass')
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: /show password/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /hide password/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('authenticated user is redirected away from login', async ({ page, request }) => {
    // Override: inject the user so the page thinks we're authenticated
    await loginAsAdmin(request, page)
    await page.goto('/login', { waitUntil: 'commit' })
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('logout clears session and redirects to login', async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/dashboard', { waitUntil: 'commit' })
    // Wait for dashboard to render
    await expect(page.locator('body')).toContainText(/dashboard/i, { timeout: 10_000 })

    // Click logout button — on mobile the sidebar may be off-screen, so use JS click
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i })
    await logoutBtn.evaluate(el => el.click())
    await page.waitForURL('**/login', { timeout: 8_000 })
    await expect(page).toHaveURL(/\/login/)

    // localStorage user should be cleared
    const userItem = await page.evaluate(() => localStorage.getItem('demopos_user'))
    expect(userItem).toBeNull()
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // No loginAsAdmin called — user is not in localStorage, so PrivateRoute redirects
    await page.goto('/dashboard', { waitUntil: 'commit' })
    await page.waitForURL('**/login', { timeout: 8_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('register page is accessible from login', async ({ page }) => {
    await expect(page.getByText('Sign up')).toBeVisible({ timeout: 15_000 })
    await page.getByText('Sign up').click()
    await expect(page).toHaveURL(/\/register/)
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible({ timeout: 10_000 })
  })

  test('forgot password link navigates to forgot password page', async ({ page }) => {
    await expect(page.getByText('Forgot password?')).toBeVisible({ timeout: 15_000 })
    await page.getByText('Forgot password?').click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })
})

test.describe('Registration', () => {
  test('register page renders', async ({ page }) => {
    await page.addInitScript(() => { localStorage.removeItem('demopos_user') })
    await page.goto('/register', { waitUntil: 'commit' })
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible({ timeout: 15_000 })
  })

  test('register with mismatched passwords shows error', async ({ page }) => {
    await page.addInitScript(() => { localStorage.removeItem('demopos_user') })
    await page.goto('/register', { waitUntil: 'commit' })
    const emailInput = page.locator('input[type="email"]')
    const passwordInputs = page.locator('input[type="password"]')
    await expect(emailInput).toBeVisible({ timeout: 15_000 })
    const uniqueEmail = `test.${Date.now()}@example.com`
    await emailInput.fill(uniqueEmail)
    if (await passwordInputs.count() >= 2) {
      await passwordInputs.nth(0).fill('password123')
      await passwordInputs.nth(1).fill('different123')
      await page.getByRole('button', { name: /register|sign up|create/i }).click()
      await expect(page.getByText('Passwords do not match')).toBeVisible({ timeout: 5_000 })
    }
  })
})
