/** Discount type values — used in both UI state and API payloads. */
export const DISCOUNT_TYPE = {
  FIXED:      'fixed',
  PERCENT:    'percent',      // UI-internal value (checkout modal state)
  PERCENTAGE: 'percentage',   // API/backend value (ProductService, VoucherService)
  OVERRIDE:   'override',     // Voucher override type
  MEMBER:     'member',       // Zero-total member redemption
}
