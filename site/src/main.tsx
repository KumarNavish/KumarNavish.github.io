import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'

import './index.css'
import App from './App.tsx'

function RoutedApplication() {
  const location = useLocation()

  useEffect(() => {
    const queryChapter = new URLSearchParams(location.search).get('chapter')
    const targetId = location.hash ? location.hash.slice(1) : queryChapter
    if (!targetId) {
      return
    }

    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    }, 0)
  }, [location.hash, location.search])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RoutedApplication />
    </BrowserRouter>
  </StrictMode>,
)
