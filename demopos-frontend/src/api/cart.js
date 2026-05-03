import api from './axios'

const cartApi = {
  clear:       ()                    => api.delete('/cart'),
  get:         ()                    => api.get('/cart'),
  add:         (productId)           => api.post('/cart', { productId }),
  increment:   (id)                  => api.patch(`/cart/${id}/increment`),
  decrement:   (id)                  => api.patch(`/cart/${id}/decrement`),
  remove:      (id)                  => api.delete(`/cart/${id}`),
  updatePrice: (id, unitPrice)       => api.put(`/cart/${id}/price`, { unitPrice }),
}

export default cartApi
