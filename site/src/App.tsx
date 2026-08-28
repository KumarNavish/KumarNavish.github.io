import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

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
