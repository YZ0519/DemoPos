import api from './axios'

export const getModifierGroups = (productId) =>
  api.get('/modifier-groups', { params: { productId } })

export const createModifierGroup = (data) => api.post('/modifier-groups', data)
export const updateModifierGroup = (id, data) => api.put(`/modifier-groups/${id}`, data)
export const deleteModifierGroup = (id) => api.delete(`/modifier-groups/${id}`)

export const createModifierOption = (groupId, data) =>
  api.post(`/modifier-groups/${groupId}/options`, data)
export const updateModifierOption = (groupId, optId, data) =>
  api.put(`/modifier-groups/${groupId}/options/${optId}`, data)
export const deleteModifierOption = (groupId, optId) =>
  api.delete(`/modifier-groups/${groupId}/options/${optId}`)
