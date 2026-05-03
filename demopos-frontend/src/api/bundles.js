import api from './axios'

// Admin management endpoint — requires product_bundle_view permission
export const getBundles = (activeOnly = false) =>
  api.get('/product-bundles', { params: activeOnly ? { activeOnly: true } : {} })

// POS endpoint — no permission gate, any authenticated user can call this
export const getPosBundles = () => api.get('/product-bundles/pos')

export const createBundle = (data) => api.post('/product-bundles', data)
export const updateBundle = (id, data) => api.put(`/product-bundles/${id}`, data)
export const deleteBundle = (id) => api.delete(`/product-bundles/${id}`)
