import api from './axios'

const paymentMethodsApi = {
  getAll:    ()         => api.get('/payment-methods'),
  getActive: ()         => api.get('/payment-methods/active'),
  create:    (data)     => api.post('/payment-methods', data),
  update:    (id, data) => api.put(`/payment-methods/${id}`, data),
  remove:    (id)       => api.delete(`/payment-methods/${id}`),
}

export default paymentMethodsApi
