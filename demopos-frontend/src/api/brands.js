import api from './axios'

const brandsApi = {
  getAll: () => api.get('/brands'),
  create: (formData) => api.post('/brands', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/brands/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => api.delete(`/brands/${id}`),
}

export default brandsApi
