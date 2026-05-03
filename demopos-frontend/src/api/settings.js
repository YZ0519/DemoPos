import api from './axios'

export const getAll            = ()     => api.get('/settings')
export const updateGeneral     = (data) => api.put('/settings/general', data)
export const updateContacts    = (data) => api.put('/settings/contacts', data)
export const updateInvoice     = (data) => api.put('/settings/invoice', data)
export const updateAppearance  = (data) => api.put('/settings/appearance', data)
