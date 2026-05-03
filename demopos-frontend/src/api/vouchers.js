import api from './axios'

export const getVouchers       = ()           => api.get('/vouchers')
export const getActiveVouchers = ()           => api.get('/vouchers/active')
export const validateVoucher   = (code)       => api.get(`/vouchers/validate?code=${encodeURIComponent(code)}`)
export const createVoucher     = (data)       => api.post('/vouchers', data)
export const updateVoucher     = (id, data)   => api.put(`/vouchers/${id}`, data)
export const removeVoucher     = (id)         => api.delete(`/vouchers/${id}`)
