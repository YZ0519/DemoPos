import api from './axios'

export const getAll          = ()         => api.get('/currencies')
export const getActiveCurrency = ()       => api.get('/currencies/active')
export const create          = (data)     => api.post('/currencies', data)
export const update          = (id, data) => api.put(`/currencies/${id}`, data)
export const remove          = (id)       => api.delete(`/currencies/${id}`)
export const setDefault      = (id)       => api.patch(`/currencies/${id}/set-default`)
