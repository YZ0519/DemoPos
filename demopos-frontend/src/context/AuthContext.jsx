import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Token is now stored exclusively as an httpOnly cookie managed by the
  // server — it is never accessible to JavaScript. We only keep the user
  // object in localStorage for permission-based UI rendering.
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('demopos_user')
    return u ? JSON.parse(u) : null
  })

  /** Called after a successful login or register response.
   *  @param {object} newUser  The user object returned by the server. */
  const login = useCallback((newUser) => {
    localStorage.setItem('demopos_user', JSON.stringify(newUser))
    setUser(newUser)
  }, [])

  /** Clears client-side user state. The caller is responsible for hitting
   *  POST /api/auth/logout first so the server can clear the cookie. */
  const logout = useCallback(() => {
    localStorage.removeItem('demopos_user')
    setUser(null)
  }, [])

  /** Merge partial fields into the stored user and persist to localStorage. */
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial }
      localStorage.setItem('demopos_user', JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
