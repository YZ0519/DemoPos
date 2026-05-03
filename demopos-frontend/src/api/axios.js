import axios from 'axios'

// The API base URL used for all HTTP calls.
// In development Vite reads .env → VITE_API_BASE_URL=https://localhost:5001/api
// In production Vite reads .env.production → VITE_API_BASE_URL=/api (same-origin)
// Exported so other modules (e.g. image URL construction) can derive the
// media host without duplicating the string literal.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001/api'

// The static media host is the origin part of the API base (strip the /api suffix).
// Used to build absolute image URLs: `${MEDIA_HOST}/${product.image}`
// When API_BASE_URL is '/api' (production same-origin), this becomes '' which is
// correct — image URLs like `/media/products/img.jpg` work without an explicit host.
export const MEDIA_HOST = API_BASE_URL.replace(/\/api$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Required for the browser to send the httpOnly access_token cookie on
  // cross-origin requests (frontend :3000 → API :5001).
  withCredentials: true,
})

// No request interceptor needed — the browser sends the httpOnly access_token
// cookie automatically on every request thanks to withCredentials: true.

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // On 401, attempt a silent token refresh using the httpOnly refresh_token
    // cookie (path=/api/auth, 7-day expiry set by the server).
    // Skip retry for the refresh and login endpoints to avoid infinite loops.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/login') &&
      // Skip token-refresh for informational endpoints that are expected to
      // work even when unauthenticated. A 401 here just means the server has
      // not yet configured a public currency — fall back to the default.
      !originalRequest.url.includes('/currencies/active')
    ) {
      originalRequest._retry = true
      try {
        // The server reads the refresh_token cookie and issues a new
        // access_token cookie — no body payload required from the client.
        await api.post('/auth/refresh')
        // Retry the original request; the new access_token cookie will be
        // sent automatically by the browser.
        return api(originalRequest)
      } catch {
        // Refresh failed (expired or missing refresh token) — evict the
        // stale user object and send the user back to login.
        // Guard: only redirect if we are NOT already on the login page.
        // Without this guard, unauthenticated API calls fired on the login
        // page (e.g. CurrencyContext fetching /currencies/active) cause a
        // hard-reload loop: 401 → refresh fails → reload /login → mount →
        // 401 again → repeat indefinitely.
        localStorage.removeItem('demopos_user')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
