import { Navigate, Route, Routes } from 'react-router-dom'

import { AtlasPage } from './atlas/AtlasPage'
import {
  CasePathChapter,
  CounterspeechChapter,
  GbrChapter,
  NaturalGradientChapter,
  RankChapter,
  TiclmChapter,
  UrbanChapter,
} from './chapters/ResearchChapters'
import { GainGraphPage } from './gainGraph/GainGraphPage'
import { SpatialLabPage } from './spatial/SpatialLabPage'
import './shared/portfolio.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AtlasPage />} />
      <Route path="/research/graph-laplacians" element={<GainGraphPage />} />
      <Route path="/research/natural-gradient-vi" element={<NaturalGradientChapter />} />
      <Route path="/research/experience-replay-optimization" element={<GbrChapter />} />
      <Route path="/research/rank-feasibility" element={<RankChapter />} />
      <Route path="/research/ticlm" element={<TiclmChapter />} />
      <Route path="/research/urban-logistics" element={<UrbanChapter />} />
      <Route path="/research/counterspeech" element={<CounterspeechChapter />} />
      <Route path="/systems/casepath" element={<CasePathChapter />} />
      <Route path="/research/spatial-intelligence" element={<SpatialLabPage />} />
      <Route path="/labs/spatial-intelligence" element={<Navigate to="/research/spatial-intelligence" replace />} />
      <Route path="/projects" element={<Navigate to="/" replace />} />
      <Route path="/work" element={<Navigate to="/" replace />} />
      <Route path="/publications" element={<Navigate to="/#atlas" replace />} />
      <Route path="/experience" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
