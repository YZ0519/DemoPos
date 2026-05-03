import api from './axios'

export const getOrders = (params = {}) => {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status !== undefined && params.status !== '') query.set('status', params.status)
  if (params.dateFrom) query.set('dateFrom', params.dateFrom)
  if (params.dateTo) query.set('dateTo', params.dateTo)
  if (params.page) query.set('page', params.page)
  if (params.pageSize) query.set('pageSize', params.pageSize)
  const qs = query.toString()
  return api.get(`/sales${qs ? `?${qs}` : ''}`)
}

export const getOrderById = (id) => api.get(`/sales/${id}`)
export const getOrderInvoice = (id) => api.get(`/sales/${id}/invoice`)
export const getOrderTransactions = (id) => api.get(`/sales/${id}/transactions`)
export const collectDue = (id, data) => api.post(`/sales/${id}/collection`, data)
export const getCollectionReceipt = (id, txnId) => api.get(`/sales/${id}/collection/${txnId}`)
export const updateOrderStatus = (id, status) => api.patch(`/sales/${id}/status`, { status })
export const deleteOrder = (id) => api.delete(`/sales/${id}`)
export const createOrder = (data) => api.post('/sales', data)
export const getPosInvoice = (id) => api.get(`/sales/${id}/pos-invoice`)
export const updateOrder = (id, data) => api.put(`/sales/${id}`, data)
export const createOrderDirect = (data) => api.post('/sales/direct', data)
