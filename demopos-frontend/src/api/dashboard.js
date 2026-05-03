import api from './axios'

/**
 * Fetch dashboard stats and chart data.
 * @param {Object} params - Optional { dateFrom: 'YYYY-MM-DD', dateTo: 'YYYY-MM-DD' }
 */
export const getDashboard = (params = {}) => {
  const query = new URLSearchParams()
  if (params.dateFrom) query.append('dateFrom', params.dateFrom)
  if (params.dateTo)   query.append('dateTo',   params.dateTo)
  const qs = query.toString()
  return api.get(`/dashboard${qs ? `?${qs}` : ''}`)
}
