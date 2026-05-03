/**
 * Applies cash rounding (nearest quantum) to a monetary total.
 * Uses integer-cent arithmetic to avoid floating-point drift.
 * Mirrors SaleService.ApplyCashRounding on the backend.
 *
 * @param {number} total    - The pre-rounding total (SubTotal - Discount). Must be >= 0.
 * @param {number} quantum  - The rounding step: 0.05 or 0.10.
 * @returns {{ roundedTotal: number, roundingAdjustment: number }}
 */
export function applyCashRounding(total, quantum = 0.05) {
  const quantumUnits = Math.round(quantum * 100)   // 5 or 10
  const totalCents   = Math.round(total   * 100)   // integer cents
  const remainder    = totalCents % quantumUnits
  const roundedCents = remainder * 2 < quantumUnits
    ? totalCents - remainder                        // round down
    : totalCents + (quantumUnits - remainder)       // round up
  const roundedTotal       = roundedCents / 100
  const roundingAdjustment = Math.round((roundedTotal - total) * 10000) / 10000
  return { roundedTotal, roundingAdjustment }
}
