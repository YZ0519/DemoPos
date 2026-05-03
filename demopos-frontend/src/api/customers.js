import api from './axios'

export const getCustomers = (page = 1, pageSize = 15, search = '') =>
  api.get('/customers', { params: { page, pageSize, ...(search ? { search } : {}) } })

export const getAllCustomers = () => api.get('/customers/all')

export const createCustomer = (data) => api.post('/customers', data)

export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)

export const deleteCustomer = (id) => api.delete(`/customers/${id}`)

export const getCustomerById = (id) => api.get(`/customers/${id}`)

export const getCustomerOrders = (id) => api.get(`/customers/${id}/sales`)
