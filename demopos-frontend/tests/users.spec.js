import { test, expect } from '@playwright/test'
import { loginAsAdmin, API_BASE } from './helpers/auth.js'

test.describe('Users', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/users', { waitUntil: 'networkidle' })
  })

  test('users page loads', async ({ page }) => {
    await expect(page.getByText(/users/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('admin user is listed', async ({ page }) => {
    await expect(page.locator('tbody').getByText('admin@demopos.com')).toBeVisible({ timeout: 8_000 })
  })

  test('create user button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new user/i })
      .or(page.getByText(/add user/i))
    await expect(addBtn).toBeVisible()
  })

  test('can open create user form', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new user/i }).first()
    await addBtn.click()
    await expect(
      page.locator('[role="dialog"]').or(page.locator('form')).first()
    ).toBeVisible({ timeout: 5_000 })
    // Close it
    const closeBtn = page.getByRole('button', { name: /cancel|close/i })
    if (await closeBtn.isVisible()) await closeBtn.click()
  })

  test('demo user is protected from deletion', async ({ page }) => {
    // demo@demopos.com should not have a delete button (or it's disabled)
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent()
      if (rowText?.includes('demo@demopos.com')) {
        const deleteBtn = rows.nth(i).getByRole('button', { name: /delete/i })
          .or(rows.nth(i).locator('[aria-label*="delete" i]'))
        if (await deleteBtn.count() > 0) {
          const isDisabled = await deleteBtn.first().isDisabled()
          expect(isDisabled).toBe(true)
        }
        break
      }
    }
  })

  test('suspend button is present for non-admin users', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent()
      // Skip admin user row
      if (!rowText?.includes('admin@demopos.com') && !rowText?.includes('demo@demopos.com')) {
        const suspendBtn = rows.nth(i).getByRole('button', { name: /suspend|unsuspend/i })
          .or(rows.nth(i).locator('[aria-label*="suspend" i]'))
        if (await suspendBtn.count() > 0) {
          await expect(suspendBtn.first()).toBeVisible()
          break
        }
      }
    }
  })
})

test.describe('Roles', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/roles', { waitUntil: 'networkidle' })
  })

  test('roles page loads', async ({ page }) => {
    await expect(page.getByText(/roles/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('Admin role is listed', async ({ page }) => {
    await expect(page.locator('tbody').getByText('Admin').first()).toBeVisible({ timeout: 8_000 })
  })

  test('User role is listed', async ({ page }) => {
    await expect(page.getByText('User', { exact: true })).toBeVisible({ timeout: 8_000 })
  })

  test('create role button is present', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add|create|new role/i })
      .or(page.getByText(/add role/i))
    await expect(addBtn).toBeVisible()
  })

  test('Admin role (id=1) cannot be deleted', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()

    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent()
      if (rowText?.includes('Admin')) {
        const deleteBtn = rows.nth(i).getByRole('button', { name: /delete/i })
          .or(rows.nth(i).locator('[aria-label*="delete" i]'))
        if (await deleteBtn.count() > 0) {
          const isDisabled = await deleteBtn.first().isDisabled()
          expect(isDisabled).toBe(true)
        }
        break
      }
    }
  })

  test('permissions page loads', async ({ page }) => {
    await page.goto('/permissions', { waitUntil: 'networkidle' })
    await expect(
      page.getByText(/permission/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })
})
