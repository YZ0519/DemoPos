import api from './axios'

export const getSuppliers = (page = 1, pageSize = 15, search = '') =>
  api.get('/suppliers', { params: { page, pageSize, ...(search ? { search } : {}) } })

export const getAllSuppliers = () => api.get('/suppliers/all')

export const createSupplier = (data) => api.post('/suppliers', data)

export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data)

export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`)
