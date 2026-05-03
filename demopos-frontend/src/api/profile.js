import api from './axios'

const profileApi = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
}

export default profileApi
