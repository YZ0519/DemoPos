import api from './axios'

const authApi = {
  login: (email, password, rememberMe = false) =>
    api.post('/auth/login', { email, password, rememberMe }),

  register: (name, email, password, passwordConfirmation) =>
    api.post('/auth/register', { name, email, password, passwordConfirmation }),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),

  verifyOtp: (email, otp) =>
    api.post('/auth/verify-otp', { email, otp }),

  resendOtp: (email) =>
    api.post('/auth/resend-otp', { email }),

  resetPassword: (email, resetToken, password, passwordConfirmation) =>
    api.post('/auth/reset-password', { email, resetToken, password, passwordConfirmation }),

  logout: () =>
    api.post('/auth/logout'),

  getProfile: () =>
    api.get('/profile'),

  updateProfile: (data) =>
    api.put('/profile', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

export default authApi
