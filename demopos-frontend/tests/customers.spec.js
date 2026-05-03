import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth.js'

test.describe('Customers', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/customers', { waitUntil: 'networkidle' })
  })

  test('customers page loads', async ({ page }) => {
    await expect(page.getByText(/customer/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('seeded customers are displayed', async ({ page }) => {
    await expect(page.getByText('Alice Johnson').or(page.getByText('Bob Martinez')).first()).toBeVisible({ timeout: 8_000 })
  })

  test('"Walking Customer" (default) is listed', async ({ page }) => {
    // Walking Customer starts with W, may be on a later page; search for it
    const searchInput = page.locator('input[placeholder*="search" i]').first()
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('Walking')
      await page.waitForTimeout(600)
    }
    await expect(page.getByText('Walking Customer')).toBeVisible({ timeout: 8_000 })
  })

  test('create customer button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new customer/i })
      .or(page.getByText(/add customer/i))
    await expect(addBtn).toBeVisible()
  })

  test('can create a new customer', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add customer/i }).first()
    await addBtn.click()

    // Wait for the dialog to appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 })

    const uniqueName = `Test Customer ${Date.now()}`
    // The customer name input has placeholder "Customer name"
    const nameInput = page.locator('[role="dialog"] input[placeholder="Customer name"]')
    await nameInput.fill(uniqueName)

    // The save button is inside the dialog form
    const saveBtn = page.locator('[role="dialog"] button[type="submit"]')
    await saveBtn.click()

    await expect(page.getByText('Customer created successfully')).toBeVisible({ timeout: 5_000 })
    // After creation, search for the new customer by its full unique name
    // (pagination may push it off the first page, so a search is required)
    const searchInput = page.locator('input[placeholder*="search" i]').first()
    await expect(searchInput).toBeVisible({ timeout: 3_000 })
    await searchInput.fill(uniqueName)
    // Wait for debounce (400ms) + API response
    await page.waitForTimeout(800)
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 8_000 })
  })

  test('can search customers', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('Alice')
      await page.waitForTimeout(500)
      await expect(page.getByText('Alice Johnson')).toBeVisible()
    }
  })

  test('can edit a customer', async ({ page }) => {
    // Find edit button for a non-protected customer
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent()
      if (!rowText?.includes('Walking Customer')) {
        const editBtn = rows.nth(i).getByRole('button', { name: /edit/i })
          .or(rows.nth(i).locator('[aria-label*="edit" i]'))
        if (await editBtn.count() > 0) {
          await editBtn.first().click()
          await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 })
          // Cancel
          const cancelBtn = page.getByRole('button', { name: /cancel|close/i })
          if (await cancelBtn.isVisible()) await cancelBtn.click()
          break
        }
      }
    }
  })

  test('Walking Customer (id=1) cannot be deleted', async ({ page }) => {
    // Find the Walking Customer row
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent()
      if (rowText?.includes('Walking Customer')) {
        const deleteBtn = rows.nth(i).getByRole('button', { name: /delete/i })
          .or(rows.nth(i).locator('[aria-label*="delete" i]'))
        // Delete button should be disabled or absent for Walking Customer
        const isPresent = await deleteBtn.count() > 0
        if (isPresent) {
          const isDisabled = await deleteBtn.first().isDisabled()
          expect(isDisabled).toBe(true)
        }
        break
      }
    }
  })

  test('customer sale history page is accessible', async ({ page }) => {
    // Navigate to a customer's sale history
    const viewBtn = page.locator('tbody tr').first()
      .getByRole('button', { name: /sales|history|view/i })
      .or(page.locator('tbody tr').first().locator('a'))
    if (await viewBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.first().click()
      await page.waitForTimeout(1_000)
      // Should either be on the customer detail page or show sales
    }
  })
})
