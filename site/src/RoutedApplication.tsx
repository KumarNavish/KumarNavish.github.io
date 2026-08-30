import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import App from './App.tsx'

export function RoutedApplication() {
  const location = useLocation()

  useEffect(() => {
    const queryChapter = new URLSearchParams(location.search).get('chapter')
    const targetId = location.hash ? location.hash.slice(1) : queryChapter

    const frame = window.requestAnimationFrame(() => {
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
        return
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.pathname, location.search])

  return <App />
}
