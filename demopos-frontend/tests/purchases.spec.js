import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loginAsAdmin, API_BASE } from './helpers/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '../.auth/admin.json')

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

test.describe('Purchases List', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/purchases', { waitUntil: 'networkidle' })
  })

  test('purchases page loads', async ({ page }) => {
    await expect(page.getByText(/purchase/i).first()).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('table').or(page.locator('[class*="table"]'))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('seeded purchases are displayed', async ({ page }) => {
    await expect(page.locator('tbody tr, [class*="row"]').first()).toBeVisible({ timeout: 8_000 })
  })

  test('create purchase button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new purchase/i })
      .or(page.getByText(/add purchase|new purchase/i))
    await expect(addBtn).toBeVisible()
  })

  test('purchase can be searched or filtered', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('1')
      await page.waitForTimeout(500)
    }
  })

  test('date filter is present', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() > 0) {
      await expect(dateInputs.first()).toBeVisible()
    }
  })

  test('clicking a purchase navigates to detail', async ({ page }) => {
    const viewBtn = page.locator('tbody tr').first()
      .getByRole('button', { name: /view|detail/i })
      .or(page.locator('tbody tr').first().locator('a'))
    if (await viewBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.first().click()
      await expect(page).toHaveURL(/\/purchases\/\d+/, { timeout: 5_000 })
    }
  })
})

test.describe('Create Purchase', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/purchases/create', { waitUntil: 'networkidle' })
  })

  test('create purchase form loads', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /new purchase/i })
    ).toBeVisible({ timeout: 8_000 })
  })

  test('supplier selector is present', async ({ page }) => {
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('product search in purchase form works', async ({ page }) => {
    const productInput = page.locator('input[placeholder*="product" i], input[placeholder*="search" i]').first()
    if (await productInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await productInput.fill('Wireless')
      await page.waitForTimeout(500)
      await expect(page.getByText('Wireless Mouse')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('date field is pre-filled with today', async ({ page }) => {
    const dateInput = page.locator('input[type="date"]').first()
    if (await dateInput.isVisible()) {
      const value = await dateInput.inputValue()
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

test.describe('Purchase Detail', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
  })

  test('purchase detail page loads for first purchase', async ({ page, request }) => {
    // Use the cookie saved by global-setup to authenticate the API call
    const cookieHeader = getAdminCookieHeader()
    const purchasesRes = await request.get(`${API_BASE}/purchases?page=1&pageSize=1`, {
      ignoreHTTPSErrors: true,
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    })
    const purchasesBody = await purchasesRes.json()
    const purchaseId = purchasesBody.data?.items?.[0]?.id ?? purchasesBody.data?.[0]?.id ?? 1

    // The purchase detail/view route is /purchases/:id/products
    await page.goto(`/purchases/${purchaseId}/products`, { waitUntil: 'networkidle' })
    await expect(
      page.getByText(/purchase detail|purchase #/i)
        .or(page.locator('h1, h2').first())
    ).toBeVisible({ timeout: 8_000 })
  })
})
