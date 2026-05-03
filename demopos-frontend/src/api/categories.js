import api from './axios'

const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (formData) => api.post('/categories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/categories/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (id) => api.delete(`/categories/${id}`),
}

export default categoriesApi
