import api from './axios'

export const getPurchases = (params = {}) => {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.supplierId !== undefined && params.supplierId !== '') query.set('supplierId', params.supplierId)
  if (params.dateFrom) query.set('dateFrom', params.dateFrom)
  if (params.dateTo) query.set('dateTo', params.dateTo)
  if (params.page) query.set('page', params.page)
  if (params.pageSize) query.set('pageSize', params.pageSize)
  const qs = query.toString()
  return api.get(`/purchases${qs ? `?${qs}` : ''}`)
}

export const getPurchaseById = (id) => api.get(`/purchases/${id}`)

export const createOrUpdatePurchase = (data) => api.post('/purchases', data)

export const getPurchaseProducts = (id) => api.get(`/purchases/${id}/products`)

export const deletePurchase = (id) => api.delete(`/purchases/${id}`)
