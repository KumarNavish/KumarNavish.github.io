import { Navigate, Route, Routes } from 'react-router-dom'

import { AtlasPage } from './atlas/AtlasPage'
import {
  NaturalGradientChapter,
  RankFeasibilityChapter,
  ReplayOptimizationChapter,
  TiCLMChapter,
} from './chapters/CoreResearchChapters'
import {
  CasePathChapter,
  CounterspeechChapter,
  UrbanLogisticsChapter,
} from './chapters/AppliedResearchChapters'
import { GainGraphPage } from './gainGraph/GainGraphPage'
import { SpatialLabPage } from './spatial/SpatialLabPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AtlasPage />} />
      <Route path="/research/graph-laplacians" element={<GainGraphPage />} />
      <Route path="/research/natural-gradient-vi" element={<NaturalGradientChapter />} />
      <Route path="/research/experience-replay-optimization" element={<ReplayOptimizationChapter />} />
      <Route path="/research/rank-feasibility" element={<RankFeasibilityChapter />} />
      <Route path="/research/ticlm" element={<TiCLMChapter />} />
      <Route path="/research/urban-logistics" element={<UrbanLogisticsChapter />} />
      <Route path="/research/counterspeech" element={<CounterspeechChapter />} />
      <Route path="/systems/casepath" element={<CasePathChapter />} />
      <Route path="/research/spatial-intelligence" element={<SpatialLabPage />} />
      <Route path="/projects" element={<Navigate to="/#atlas" replace />} />
      <Route path="/work" element={<Navigate to="/#atlas" replace />} />
      <Route path="/publications" element={<Navigate to="/#atlas" replace />} />
      <Route path="/experience" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
