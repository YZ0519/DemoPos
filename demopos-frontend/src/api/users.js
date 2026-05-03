import api from './axios'

const usersApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  suspend: (id, isSuspended) => api.patch(`/users/${id}/suspend`, { isSuspended }),
}

export default usersApi
