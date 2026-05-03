import api from './axios'

const productsApi = {
  getAll: (page = 1, pageSize = 20, search = '') =>
    api.get('/products', { params: { page, pageSize, ...(search ? { search } : {}) } }),
  // POS-filtered search: status=1 AND quantity>=1 only (for POS terminal use)
  search: (q) => api.get('/products/search', { params: { q } }),
  // Full product search: all products regardless of status/stock (for purchase form use)
  // Uses /purchase-search which requires purchase_create or purchase_update permission
  // Supports pagination: returns { items: ProductDto[], hasMore: boolean }
  searchAll: (q, page = 1, pageSize = 10) =>
    api.get('/products/purchase-search', { params: { q, page, pageSize } }),
  // Sale-filtered search: active products with stock (for sale order form use)
  // Uses /sale-search which requires sale_create or sale_update permission
  // Returns { items: ProductDto[], hasMore: boolean }
  searchForSale: (q, page = 1, pageSize = 10) =>
    api.get('/products/sale-search', { params: { q, page, pageSize } }),
  create: (formData) => api.post('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => api.delete(`/products/${id}`),
  // POS product browser: active+stocked products with pagination and optional search
  getPosProducts: (params = {}) => {
    const q = new URLSearchParams()
    if (params.q)        q.set('q', params.q)
    if (params.page)     q.set('page', params.page)
    if (params.pageSize) q.set('pageSize', params.pageSize)
    const qs = q.toString()
    return api.get(`/products/pos${qs ? `?${qs}` : ''}`)
  },
  // Bulk enable/disable POS visibility. Use a single-element array for inline row toggle.
  bulkSetPosEnabled: (ids, posEnabled) =>
    api.patch('/products/pos-enabled', { ids, posEnabled }),
}

export default productsApi
