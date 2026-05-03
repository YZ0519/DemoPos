import api from './axios'

const demoApi = {
  reset: () => api.post('/demo/reset'),
}

export default demoApi
