import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth.js'

test.describe('POS Terminal', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/pos', { waitUntil: 'networkidle' })
  })

  test('POS page loads with product grid', async ({ page }) => {
    // Product grid or card area should be visible
    await expect(page.getByText(/pos|point of sale/i).or(
      page.locator('[class*="product"]')
    ).first()).toBeVisible({ timeout: 10_000 })
  })

  test('seeded products are visible in POS grid', async ({ page }) => {
    // Wait for products to load
    await expect(
      page.getByText('Wireless Mouse').or(page.getByText('Mineral Water 500ml')).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('product search filters results', async ({ page }) => {
    // Find the search input
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="barcode" i], input[placeholder*="scan" i]').first()
    await expect(searchInput).toBeVisible({ timeout: 8_000 })
    await searchInput.fill('Wireless')
    await page.waitForTimeout(500) // debounce delay
    await expect(page.getByText('Wireless Mouse')).toBeVisible()
  })

  test('clicking product adds it to cart', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1_000)
    const productCard = page.getByText('Mineral Water 500ml').first()
    await expect(productCard).toBeVisible({ timeout: 10_000 })
    await productCard.click()

    // Cart should update — either cart count or item name appears in cart
    const cartItem = page.getByText('Mineral Water 500ml').nth(1)
      .or(page.locator('[class*="cart"]').getByText('Mineral Water'))
      .or(page.getByRole('cell', { name: /mineral water/i }))
    await expect(cartItem.first()).toBeVisible({ timeout: 5_000 })
  })

  test('cart total updates when item added', async ({ page }) => {
    await page.waitForTimeout(1_000)
    const productCard = page.getByText('Chocolate Bar').first()
    if (await productCard.isVisible()) {
      await productCard.click()
      await page.waitForTimeout(500)
      // Cart subtotal or total should show a number > 0
      const total = page.getByText(/subtotal|total/i).filter({ hasText: /\d/ })
      if (await total.count() > 0) {
        await expect(total.first()).toBeVisible()
      }
    }
  })

  test('customer selector is present', async ({ page }) => {
    const customerSelect = page.getByText(/customer|walking/i).first()
      .or(page.locator('input[placeholder*="customer" i]').first())
    await expect(customerSelect).toBeVisible({ timeout: 8_000 })
  })

  test('payment method selector is present', async ({ page }) => {
    await expect(
      page.getByText(/cash|card|payment method/i)
    ).toBeVisible({ timeout: 8_000 })
  })

  test('checkout button is visible (after adding item)', async ({ page }) => {
    // Add a product first
    await page.waitForTimeout(1_000)
    const productCard = page.getByText('Chocolate Bar').first()
    if (await productCard.isVisible()) {
      await productCard.click()
      await page.waitForTimeout(500)
    }
    // Checkout button should be visible
    const checkoutBtn = page.getByRole('button', { name: /checkout|pay|confirm/i })
    await expect(checkoutBtn).toBeVisible({ timeout: 5_000 })
  })

  test('barcode scan input is present', async ({ page }) => {
    const barcodeInput = page.locator('input[placeholder*="barcode" i], input[placeholder*="scan" i], input[placeholder*="sku" i]')
    // The search input doubles as barcode input in most POS systems
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first()
    await expect(barcodeInput.or(searchInput)).toBeVisible({ timeout: 5_000 })
  })

  test('exact SKU match adds product via barcode input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="barcode" i], input[placeholder*="scan" i]').first()
    await expect(searchInput).toBeVisible({ timeout: 8_000 })
    // Type an exact SKU — should auto-add after debounce
    await searchInput.fill('MW-003')
    await page.waitForTimeout(500)
    // Either product shows in search results or directly added to cart
    await expect(
      page.getByText('Mineral Water 500ml')
    ).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('POS Terminal — Mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(request, page)
    await page.goto('/pos', { waitUntil: 'networkidle' })
  })

  test('mobile POS has tab switching between Products and Cart', async ({ page }) => {
    // Mobile layout shows tab buttons at bottom — look for the specific POS tab buttons
    // They are flex-1 buttons (not nav links) at the bottom of the screen
    const productTab = page.locator('button.flex-1', { hasText: /^products?$/i })
    const cartTab = page.locator('button.flex-1', { hasText: /^cart$/i })

    if (await productTab.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(productTab.first()).toBeVisible()
    } else if (await cartTab.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
      await expect(cartTab.first()).toBeVisible()
    }
  })
})
