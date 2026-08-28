import { Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { FieldPage } from './field/FieldPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FieldPage />} />
      <Route path="/research/experience-replay-optimization" element={<FieldPage />} />
      <Route path="/projects" element={<Navigate to="/?chapter=proof" replace />} />
      <Route path="/work" element={<Navigate to="/?chapter=proof" replace />} />
      <Route path="/publications" element={<Navigate to="/?chapter=replay" replace />} />
      <Route path="/experience" element={<Navigate to="/?chapter=trajectory" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
