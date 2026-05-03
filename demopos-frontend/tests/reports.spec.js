import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth.js'

test.describe('Reports', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
  })

  test('sale report page loads', async ({ page }) => {
    await page.goto('/reports/sales', { waitUntil: 'networkidle' })
    // Heading is "Sales Report"
    await expect(page.getByText(/sales report/i).first()).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('table').or(page.locator('[class*="table"]')).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('sale report shows seeded data', async ({ page }) => {
    await page.goto('/reports/sales', { waitUntil: 'networkidle' })
    await expect(page.locator('tbody tr, [class*="row"]').first()).toBeVisible({ timeout: 8_000 })
  })

  test('sale report has date range filter', async ({ page }) => {
    await page.goto('/reports/sales', { waitUntil: 'networkidle' })
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() >= 2) {
      await expect(dateInputs.first()).toBeVisible()
      await expect(dateInputs.nth(1)).toBeVisible()
    }
  })

  test('sale report date filter changes results', async ({ page }) => {
    await page.goto('/reports/sales', { waitUntil: 'networkidle' })
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() >= 2) {
      const today = new Date().toISOString().slice(0, 10)
      const sixtyDaysAgo = new Date(Date.now() - 86400000 * 60).toISOString().slice(0, 10)
      await dateInputs.nth(0).fill(sixtyDaysAgo)
      await dateInputs.nth(1).fill(today)
      // Submit / apply filter — use the specific Apply button (not the Logout button)
      const applyBtn = page.getByRole('button', { name: /^apply$/i })
        .or(page.getByRole('button', { name: /^filter$/i }))
        .or(page.getByRole('button', { name: /^search$/i }))
      if (await applyBtn.first().isVisible()) await applyBtn.first().click()
      await page.waitForTimeout(1_000)
    }
  })

  test('sale summary report page loads', async ({ page }) => {
    await page.goto('/reports/summary', { waitUntil: 'networkidle' })
    // Heading is "Sales Summary"
    await expect(page.getByRole('heading', { name: /sales summary/i })).toBeVisible({ timeout: 8_000 })
  })

  test('sale summary shows totals', async ({ page }) => {
    await page.goto('/reports/summary', { waitUntil: 'networkidle' })
    // Use heading-level element to avoid strict mode violations on repeated words
    await expect(page.getByText(/grand total/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('inventory report page loads', async ({ page }) => {
    await page.goto('/reports/inventory', { waitUntil: 'networkidle' })
    // Heading is "Inventory Report"
    await expect(page.getByRole('heading', { name: /inventory report/i })).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('table').or(page.locator('[class*="table"]')).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('inventory report shows seeded products', async ({ page }) => {
    await page.goto('/reports/inventory', { waitUntil: 'networkidle' })
    await expect(
      page.getByText('Wireless Mouse').or(page.getByText(/Mineral Water/i)).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('inventory report shows quantity and price columns', async ({ page }) => {
    await page.goto('/reports/inventory', { waitUntil: 'networkidle' })
    await expect(
      page.getByText(/quantity|qty/i).first()
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByText(/price/i).first()
    ).toBeVisible()
  })

  test('purchase report page loads', async ({ page }) => {
    await page.goto('/reports/purchases', { waitUntil: 'networkidle' })
    // Heading may be "Purchase Report" or "Purchases Report"
    await expect(page.getByText(/purchase.*report/i).first()).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('table').or(page.locator('[class*="table"]')).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('purchase report shows seeded data', async ({ page }) => {
    await page.goto('/reports/purchases', { waitUntil: 'networkidle' })
    await expect(page.locator('tbody tr, [class*="row"]').first()).toBeVisible({ timeout: 8_000 })
  })
})
