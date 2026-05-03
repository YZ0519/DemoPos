import api from './axios'

export const getOpenOrders          = ()                    => api.get('/sales/open')
export const getOpenOrderForTable   = (tableId)             => api.get(`/sales/open/table/${tableId}`)
export const createOpenOrder        = (data)                => api.post('/sales/open', data)
export const addItemToOrder         = (saleId, data)        => api.post(`/sales/${saleId}/items`, data)
export const addItemsBatch          = (saleId, items)       => api.post(`/sales/${saleId}/items/batch`, items)
export const updateOrderItem        = (saleId, itemId, data)=> api.put(`/sales/${saleId}/items/${itemId}`, data)
export const voidOrderItem          = (saleId, itemId)      => api.delete(`/sales/${saleId}/items/${itemId}`)
export const sendToKitchen          = (saleId)              => api.post(`/sales/${saleId}/send-kitchen`)
export const settleOrder            = (saleId, data)        => api.post(`/sales/${saleId}/settle`, data)
export const mergeOrders            = (saleId, data)        => api.post(`/sales/${saleId}/merge`, data)
