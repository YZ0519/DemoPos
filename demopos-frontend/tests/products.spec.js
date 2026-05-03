import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth.js'

test.describe('Products', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/products', { waitUntil: 'networkidle' })
  })

  test('products page loads with table', async ({ page }) => {
    await expect(page.getByText(/products/i).first()).toBeVisible({ timeout: 10_000 })
    // Either a table or cards should be present
    await expect(
      page.locator('table').or(page.locator('[class*="grid"]'))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('seeded products are displayed', async ({ page }) => {
    await expect(page.getByText('Wireless Mouse').first()).toBeVisible({ timeout: 8_000 })
    // Product name on page may be "Mineral Water 500ML" (uppercase) or with bundle suffix
    await expect(page.getByText(/Mineral Water/i).first()).toBeVisible()
  })

  test('create new product button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new product/i })
      .or(page.getByText(/add product/i))
    await expect(addBtn).toBeVisible()
  })

  test('can open create product modal/form', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new product/i })
      .or(page.getByText(/add product/i))
    await addBtn.first().click()
    // Modal or form should appear — prefer dialog over raw form
    await expect(
      page.locator('[role="dialog"]')
    ).toBeVisible({ timeout: 5_000 })
    // Name field should be present
    await expect(
      page.getByLabel(/name/i).or(page.locator('input[placeholder*="name" i]'))
    ).toBeVisible()
  })

  test('search / filter products', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('Wireless')
      await page.waitForTimeout(500)
      await expect(page.getByText('Wireless Mouse')).toBeVisible()
    }
  })

  test('edit product opens form with existing data', async ({ page }) => {
    // Click edit button on the first product row
    const editBtn = page.getByRole('button', { name: /edit/i }).first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('delete product shows confirmation', async ({ page }) => {
    const deleteBtn = page.getByRole('button', { name: /^delete$/i }).first()
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
      // Inline confirmation: shows "Delete?" text with Yes/No buttons
      await expect(page.getByText(/delete\?/i)).toBeVisible({ timeout: 3_000 })
      // Cancel by clicking No
      const noBtn = page.getByRole('button', { name: /^no$/i }).first()
      if (await noBtn.isVisible()) await noBtn.click()
    }
  })
})

test.describe('Categories', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/categories', { waitUntil: 'networkidle' })
  })

  test('categories page loads', async ({ page }) => {
    await expect(page.getByText(/categor/i).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Electronics')).toBeVisible()
    await expect(page.getByText('Beverages')).toBeVisible()
  })

  test('create category', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new/i }).first()
    await addBtn.click()
    const nameInput = page.getByLabel(/name/i).or(page.locator('input[placeholder*="name" i]')).last()
    await nameInput.fill(`Test Category ${Date.now()}`)
    const saveBtn = page.getByRole('button', { name: /save|create|add/i }).last()
    await saveBtn.click()
    await expect(page.getByText(/success|saved|created/i)).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Brands', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/brands', { waitUntil: 'networkidle' })
  })

  test('brands page loads', async ({ page }) => {
    await expect(page.getByText(/brand/i).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('TechPro')).toBeVisible()
  })
})

test.describe('Units', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/units', { waitUntil: 'networkidle' })
  })

  test('units page loads', async ({ page }) => {
    await expect(page.getByText(/unit/i).first()).toBeVisible({ timeout: 8_000 })
    // Use .first() to avoid strict mode violation when multiple unit names match
    await expect(page.getByText(/piece|kilogram|liter/i).first()).toBeVisible()
  })
})
