import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const PortfolioHomePage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.PortfolioHomePage })),
)
const TrajectoryPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.TrajectoryPage })),
)
const WorkIndexPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.WorkIndexPage })),
)
const ResearchPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.ResearchPage })),
)
const SystemsPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.SystemsPage })),
)
const FrontierPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.FrontierPage })),
)
const AboutPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.AboutPage })),
)
const RegistryWorkPage = lazy(() =>
  import('./portfolio/PortfolioPages').then((module) => ({ default: module.RegistryWorkPage })),
)
const GainGraphPage = lazy(() =>
  import('./gainGraph/GainGraphPage').then((module) => ({ default: module.GainGraphPage })),
)
const NaturalGradientChapter = lazy(() =>
  import('./chapters/CoreResearchChapters').then((module) => ({ default: module.NaturalGradientChapter })),
)
const ReplayOptimizationChapter = lazy(() =>
  import('./chapters/CoreResearchChapters').then((module) => ({ default: module.ReplayOptimizationChapter })),
)
const RankFeasibilityChapter = lazy(() =>
  import('./chapters/CoreResearchChapters').then((module) => ({ default: module.RankFeasibilityChapter })),
)
const TiCLMChapter = lazy(() =>
  import('./chapters/CoreResearchChapters').then((module) => ({ default: module.TiCLMChapter })),
)
const UrbanLogisticsChapter = lazy(() =>
  import('./chapters/AppliedResearchChapters').then((module) => ({ default: module.UrbanLogisticsChapter })),
)
const CounterspeechChapter = lazy(() =>
  import('./chapters/AppliedResearchChapters').then((module) => ({ default: module.CounterspeechChapter })),
)
const CasePathChapter = lazy(() =>
  import('./chapters/AppliedResearchChapters').then((module) => ({ default: module.CasePathChapter })),
)
const SpatialLabPage = lazy(() =>
  import('./spatial/SpatialLabPage').then((module) => ({ default: module.SpatialLabPage })),
)

function LoadingSurface() {
  return (
    <div className="initial-light-surface" role="status" aria-live="polite">
      Loading the research surface…
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSurface />}>
      <Routes>
        <Route path="/" element={<PortfolioHomePage />} />
        <Route path="/trajectory" element={<TrajectoryPage />} />
        <Route path="/work" element={<WorkIndexPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/systems" element={<SystemsPage />} />
        <Route path="/frontier" element={<FrontierPage />} />
        <Route path="/about" element={<AboutPage />} />

        <Route path="/work/gain-graphs" element={<GainGraphPage />} />
        <Route path="/work/normalized-gain-laplacians" element={<RegistryWorkPage workId="normalized-gain-laplacians" />} />
        <Route path="/work/extremal-gain-laplacian-bounds" element={<RegistryWorkPage workId="extremal-gain-laplacian-bounds" />} />
        <Route path="/work/counterspeech-dynamics" element={<CounterspeechChapter />} />
        <Route path="/work/urban-microregion-logistics" element={<UrbanLogisticsChapter />} />
        <Route path="/work/square-root-natural-gradient" element={<NaturalGradientChapter />} />
        <Route path="/work/experience-replay-optimization" element={<ReplayOptimizationChapter />} />
        <Route path="/work/rank-feasibility" element={<RankFeasibilityChapter />} />
        <Route path="/work/ticlm-replay-value" element={<TiCLMChapter />} />
        <Route path="/systems/casepath" element={<CasePathChapter />} />
        <Route path="/frontier/spatial-intelligence" element={<SpatialLabPage />} />

        <Route path="/work/casepath" element={<Navigate to="/systems/casepath" replace />} />
        <Route path="/work/spatial-intelligence" element={<Navigate to="/frontier/spatial-intelligence" replace />} />
        <Route path="/research/graph-laplacians" element={<Navigate to="/work/gain-graphs" replace />} />
        <Route path="/research/natural-gradient-vi" element={<Navigate to="/work/square-root-natural-gradient" replace />} />
        <Route path="/research/experience-replay-optimization" element={<Navigate to="/work/experience-replay-optimization" replace />} />
        <Route path="/research/rank-feasibility" element={<Navigate to="/work/rank-feasibility" replace />} />
        <Route path="/research/ticlm" element={<Navigate to="/work/ticlm-replay-value" replace />} />
        <Route path="/research/urban-logistics" element={<Navigate to="/work/urban-microregion-logistics" replace />} />
        <Route path="/research/counterspeech" element={<Navigate to="/work/counterspeech-dynamics" replace />} />
        <Route path="/research/spatial-intelligence" element={<Navigate to="/frontier/spatial-intelligence" replace />} />
        <Route path="/projects" element={<Navigate to="/work" replace />} />
        <Route path="/publications" element={<Navigate to="/research" replace />} />
        <Route path="/experience" element={<Navigate to="/trajectory" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
