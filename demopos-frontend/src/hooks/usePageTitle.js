import { useEffect } from 'react'

/**
 * Sets the document title to `${title} — DemoPos` while the component
 * is mounted, then restores the default on unmount.
 * @param {string} title - The page-specific title segment.
 */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} — DemoPos`
    return () => {
      document.title = 'DemoPos'
    }
  }, [title])
}
