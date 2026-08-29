import { Navigate, Route, Routes } from 'react-router-dom'

import { GainGraphPage } from './gainGraph/GainGraphPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GainGraphPage />} />
      <Route path="/research/graph-laplacians" element={<Navigate to="/#instrument" replace />} />
      <Route path="/research/experience-replay-optimization" element={<Navigate to="/#continuation" replace />} />
      <Route path="/research/rank-feasibility" element={<Navigate to="/#continuation" replace />} />
      <Route path="/research/ticlm" element={<Navigate to="/#continuation" replace />} />
      <Route path="/systems/casepath" element={<Navigate to="/#continuation" replace />} />
      <Route path="/research/spatial-intelligence" element={<Navigate to="/#continuation" replace />} />
      <Route path="/projects" element={<Navigate to="/#continuation" replace />} />
      <Route path="/work" element={<Navigate to="/#continuation" replace />} />
      <Route path="/publications" element={<Navigate to="/#evidence" replace />} />
      <Route path="/experience" element={<Navigate to="/#top" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
