import api from './axios'

const rolesApi = {
  getAll:          ()           => api.get('/roles'),
  create:          (data)       => api.post('/roles', data),
  update:          (id, data)   => api.put(`/roles/${id}`, data),
  delete:          (id)         => api.delete(`/roles/${id}`),
  getPermissions:  (id)         => api.get(`/roles/${id}/permissions`),
  syncPermissions: (id, perms)  => api.post(`/roles/${id}/permissions`, { permissions: perms }),
}

export default rolesApi
