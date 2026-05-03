import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getAll, updateAppearance } from '../api/settings'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'demopos_theme'

/**
 * Apply or remove the `dark` class on <html> and update the stored theme value.
 * This is a pure DOM side-effect function — no React state involved.
 */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function ThemeProvider({ children }) {
  /**
   * Initialise theme synchronously from localStorage so there is no flash of
   * the wrong theme before the first render.
   *
   * Initialiser function runs once; order of precedence:
   *   1. localStorage (per-device override, instant)
   *   2. Falls back to 'light' — the async backend fetch will update it if needed
   */
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial = stored === 'dark' || stored === 'light' ? stored : 'light'
    applyTheme(initial)
    return initial
  })

  /**
   * On mount, if no localStorage value exists, fetch the backend setting and
   * apply it. This syncs the preference when a user logs in on a new device.
   */
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return // localStorage takes precedence — nothing to do

    const userJson = localStorage.getItem('demopos_user')
    if (!userJson) return // unauthenticated — skip API call to avoid 401 redirect loop

    getAll()
      .then((res) => {
        const data = res.data?.data ?? {}
        const isDark = data.dark_mode === 'true' || data.dark_mode === true
        const serverTheme = isDark ? 'dark' : 'light'
        localStorage.setItem(STORAGE_KEY, serverTheme)
        applyTheme(serverTheme)
        setTheme(serverTheme)
      })
      .catch(() => {
        // Backend not available (404, network error, etc.) — keep light default
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * toggleTheme:
   *   - Flips the `dark` class on <html>
   *   - Updates localStorage immediately
   *   - Fire-and-forgets a PUT /api/settings/appearance to sync the backend
   */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      applyTheme(next)
      // Fire-and-forget — UI is already updated; backend failure is silently ignored
      updateAppearance({ darkMode: next === 'dark' }).catch(() => {})
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
