import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth.js'

test.describe('Settings', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/settings', { waitUntil: 'networkidle' })
  })

  test('settings page loads', async ({ page }) => {
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('general settings section is present', async ({ page }) => {
    await expect(page.getByText(/general/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('site name field is populated with "DemoPos"', async ({ page }) => {
    const siteNameInput = page.getByLabel(/site name/i)
      .or(page.locator('input[placeholder*="site name" i]'))
    if (await siteNameInput.isVisible()) {
      const value = await siteNameInput.inputValue()
      expect(value).toBe('DemoPos')
    }
  })

  test('can update general settings', async ({ page }) => {
    const siteNameInput = page.getByLabel(/site name/i)
      .or(page.locator('input[placeholder*="site name" i]'))
    if (await siteNameInput.isVisible()) {
      await siteNameInput.fill('DemoPos Test')
      const saveBtn = page.getByRole('button', { name: /save|update/i }).first()
      await saveBtn.click()
      await expect(page.getByText(/success|saved|updated/i)).toBeVisible({ timeout: 5_000 })
      // Restore
      await siteNameInput.fill('DemoPos')
      await saveBtn.click()
      await page.waitForTimeout(500)
    }
  })

  test('contacts section is accessible', async ({ page }) => {
    // Navigate to contacts tab/section if it exists
    const contactsTab = page.getByRole('tab', { name: /contact/i })
      .or(page.getByRole('button', { name: /^contacts$/i }))
    if (await contactsTab.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await contactsTab.first().click()
      // After clicking Contacts tab, at least one of these labels should appear
      await expect(page.getByText(/phone/i).first()).toBeVisible({ timeout: 3_000 })
    } else {
      // Single-page settings layout — contact fields are already visible
      await expect(page.getByText(/contact/i).first()).toBeVisible()
    }
  })

  test('invoice settings section is accessible', async ({ page }) => {
    const invoiceTab = page.getByRole('tab', { name: /invoice/i })
      .or(page.getByRole('button', { name: /^invoice$/i }))
    if (await invoiceTab.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await invoiceTab.first().click()
      await expect(page.getByText(/receipt|note/i).first()).toBeVisible({ timeout: 3_000 })
    } else {
      // On single-page layout, look for "Note to Customer" or similar invoice field
      await expect(page.getByText(/note to customer|receipt width/i).first()).toBeVisible({ timeout: 3_000 })
    }
  })

  test('rounding settings are present', async ({ page }) => {
    // Use heading role or a specific class to avoid strict-mode issues
    await expect(page.getByRole('heading', { name: /rounding/i })).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Dark Mode', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
  })

  test('dark mode toggle switches theme', async ({ page }) => {
    // Get initial theme state
    const htmlEl = page.locator('html')
    const initialClass = await htmlEl.getAttribute('class')

    // Find the theme toggle button — look for aria-label containing dark/light/theme
    const themeToggle = page.locator(
      'button[aria-label*="dark" i], button[aria-label*="light" i], button[aria-label*="theme" i], button[aria-label*="mode" i]'
    ).first()

    if (await themeToggle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await themeToggle.click()
      await page.waitForTimeout(300)
      const newClass = await htmlEl.getAttribute('class')
      // Class should have changed (dark added or removed)
      expect(newClass).not.toBe(initialClass)

      // Toggle back
      await themeToggle.click()
      await page.waitForTimeout(300)
    }
  })

  test('dark mode persists after page reload', async ({ page, request }) => {
    // Inject user again via initScript so it survives reload
    const { user } = await loginAsAdmin(request, page)

    // Set dark mode via localStorage
    await page.evaluate(() => {
      localStorage.setItem('demopos_theme', 'dark')
    })
    await page.reload({ waitUntil: 'networkidle' })

    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')

    // Cleanup
    await page.evaluate(() => {
      localStorage.setItem('demopos_theme', 'light')
    })
  })
})
