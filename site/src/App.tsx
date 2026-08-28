import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

const MotionNativePage = lazy(() => import('./motion/MotionNativePage'))

function LoadingSurface() {
  return (
    <main
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#090b0e',
        color: '#f5f3ed',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p>Loading the research instruments…</p>
    </main>
  )
}

function InstrumentPage() {
  const location = useLocation()

  useEffect(() => {
    const targetId = location.hash.replace(/^#/, '')
    if (!targetId) {
      return undefined
    }

    let frame = 0
    let attempts = 0
    const restoreChapter = () => {
      const target = document.getElementById(targetId)
      if (!target && attempts < 120) {
        attempts += 1
        frame = window.requestAnimationFrame(restoreChapter)
        return
      }
      if (!target) {
        return
      }

      const root = document.documentElement
      const previousBehavior = root.style.scrollBehavior
      root.style.scrollBehavior = 'auto'
      target.scrollIntoView({ block: 'start', behavior: 'auto' })
      root.style.scrollBehavior = previousBehavior
    }

    frame = window.requestAnimationFrame(restoreChapter)
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])

  return (
    <Suspense fallback={<LoadingSurface />}>
      <MotionNativePage />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InstrumentPage />} />
      <Route path="/research/graph-laplacians" element={<Navigate to="/#graph" replace />} />
      <Route path="/research/experience-replay-optimization" element={<Navigate to="/#replay" replace />} />
      <Route path="/research/rank-feasibility" element={<Navigate to="/#rank" replace />} />
      <Route path="/research/ticlm" element={<Navigate to="/#temporal" replace />} />
      <Route path="/systems/casepath" element={<Navigate to="/#casepath" replace />} />
      <Route path="/research/spatial-intelligence" element={<Navigate to="/#spatial" replace />} />
      <Route path="/projects" element={<Navigate to="/#atlas" replace />} />
      <Route path="/work" element={<Navigate to="/#atlas" replace />} />
      <Route path="/publications" element={<Navigate to="/#atlas" replace />} />
      <Route path="/experience" element={<Navigate to="/#entry" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
