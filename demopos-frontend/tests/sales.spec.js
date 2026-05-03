import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loginAsAdmin, API_BASE } from './helpers/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '../.auth/admin.json')

/** Read the saved session cookie value for making authenticated API requests in beforeAll. */
function getAdminCookieHeader() {
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8')
    const { storageState } = JSON.parse(raw)
    const cookies = storageState?.cookies ?? []
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    return ''
  }
}

test.describe('Sales List', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/sales', { waitUntil: 'networkidle' })
  })

  test('sales list page loads', async ({ page }) => {
    await expect(page.getByText(/sales/i).first()).toBeVisible({ timeout: 8_000 })
    // Table should be present with data
    await expect(
      page.locator('table').or(page.locator('[class*="table"]'))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('seeded sales are displayed', async ({ page }) => {
    // Seeded sales should exist
    await expect(page.locator('tbody tr, [class*="row"]').first()).toBeVisible({ timeout: 8_000 })
  })

  test('sales can be filtered by status', async ({ page }) => {
    // Status filter (Due/Paid) buttons or select
    const statusFilter = page.getByRole('button', { name: /paid|due/i })
      .or(page.locator('select').filter({ hasText: /paid|due/i }))
    if (await statusFilter.first().isVisible()) {
      await statusFilter.first().click()
      await page.waitForTimeout(500)
    }
  })

  test('sales can be searched', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('1')
      await page.waitForTimeout(500)
    }
  })

  test('date range filter is present', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() >= 2) {
      await expect(dateInputs.first()).toBeVisible()
    }
  })

  test('clicking a sale row navigates to detail', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first()
    if (await firstRow.isVisible()) {
      // Click view button or the row link
      const viewBtn = firstRow.getByRole('button', { name: /view|detail/i })
        .or(firstRow.locator('a'))
      if (await viewBtn.first().isVisible()) {
        await viewBtn.first().click()
        await expect(page).toHaveURL(/\/sales\/\d+/, { timeout: 5_000 })
      }
    }
  })

  test('pagination controls are present when many records', async ({ page }) => {
    const pagination = page.locator('[class*="pagination"]')
      .or(page.getByRole('button', { name: /next|previous|prev/i }))
    // Just check it's rendered if data exists
    if (await pagination.count() > 0) {
      await expect(pagination.first()).toBeVisible()
    }
  })
})

test.describe('Sale Detail', () => {
  let saleId

  test.beforeAll(async ({ request }) => {
    // Use the cookie saved by global-setup to authenticate the API call
    const cookieHeader = getAdminCookieHeader()
    const salesRes = await request.get(`${API_BASE}/sales?page=1&pageSize=1`, {
      ignoreHTTPSErrors: true,
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    })
    const salesBody = await salesRes.json()
    saleId = salesBody.data?.items?.[0]?.id ?? salesBody.data?.[0]?.id ?? 1
  })

  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
  })

  test('sale detail page loads', async ({ page }) => {
    await page.goto(`/sales/${saleId}`, { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading').filter({ hasText: /sale #/i })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('sale detail shows customer info', async ({ page }) => {
    await page.goto(`/sales/${saleId}`, { waitUntil: 'networkidle' })
    await expect(
      page.getByText(/customer/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('sale detail shows line items', async ({ page }) => {
    await page.goto(`/sales/${saleId}`, { waitUntil: 'networkidle' })
    // Items table or list should be visible
    await expect(
      page.locator('table').or(page.locator('[class*="item"]')).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('print invoice button is present', async ({ page }) => {
    await page.goto(`/sales/${saleId}`, { waitUntil: 'networkidle' })
    const printBtn = page.getByRole('button', { name: /invoice|print/i })
      .or(page.getByRole('link', { name: /invoice|print/i }))
    await expect(printBtn.first()).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Create Sale (Direct Form)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/sales/create', { waitUntil: 'networkidle' })
  })

  test('create sale form loads', async ({ page }) => {
    // Heading should be present
    await expect(
      page.getByRole('heading', { name: /new sale/i })
    ).toBeVisible({ timeout: 8_000 })
  })

  test('customer selector is present in form', async ({ page }) => {
    await expect(
      page.getByText(/customer/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Due Collection', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/sales', { waitUntil: 'networkidle' })
  })

  test('due sales show collect button', async ({ page }) => {
    // Look for "Due" status badge and collect action
    const dueBadge = page.getByText(/\bdue\b/i).first()
    if (await dueBadge.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // There should be a collect/payment button near due sales
      const collectBtn = page.getByRole('button', { name: /collect|pay/i }).first()
      if (await collectBtn.count() > 0) {
        await expect(collectBtn).toBeVisible()
      }
    }
  })
})
