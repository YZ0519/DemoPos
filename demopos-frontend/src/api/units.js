import api from './axios'

const unitsApi = {
  getAll: () => api.get('/units'),
  create: (data) => api.post('/units', data),
  update: (id, data) => api.put(`/units/${id}`, data),
  remove: (id) => api.delete(`/units/${id}`),
}

export default unitsApi
