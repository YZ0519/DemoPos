import api from './axios'

const permissionsApi = {
  getAll: () => api.get('/permissions'),
}

export default permissionsApi
