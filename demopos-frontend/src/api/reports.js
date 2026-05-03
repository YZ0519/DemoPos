import api from './axios'

/**
 * Fetch sale report rows + totals for a date range.
 */
export const getSaleReport = (startDate, endDate) => {
  const params = new URLSearchParams({ startDate, endDate })
  return api.get(`/reports/sales?${params}`)
}

/**
 * Fetch a single-row summary for a date range.
 */
export const getSaleSummary = (startDate, endDate) => {
  const params = new URLSearchParams({ startDate, endDate })
  return api.get(`/reports/summary?${params}`)
}

/**
 * Fetch full inventory snapshot (no pagination).
 */
export const getInventoryReport = () => api.get('/reports/inventory')

/**
 * Fetch purchase report rows + totals for a date range.
 */
export const getPurchaseReport = (startDate, endDate) => {
  const params = new URLSearchParams({ startDate, endDate })
  return api.get(`/reports/purchases?${params}`)
}

/**
 * Fetch profit & loss summary for a date range.
 */
export const getProfitLossReport = (startDate, endDate) => {
  const params = new URLSearchParams({ startDate, endDate })
  return api.get(`/reports/profit-loss?${params}`)
}
