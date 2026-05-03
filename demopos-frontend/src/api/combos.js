import api from './axios'

export const getComboItems = (productId) => api.get(`/products/${productId}/combo-items`)
export const addComboItem = (productId, data) => api.post(`/products/${productId}/combo-items`, data)
export const removeComboItem = (productId, componentId) =>
  api.delete(`/products/${productId}/combo-items/${componentId}`)
