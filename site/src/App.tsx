import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { ARC_STEPS } from './lib/arc'
import { DashboardPage } from './pages/DashboardPage'
import { ExperiencePage } from './pages/ExperiencePage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PublicationsPage } from './pages/PublicationsPage'
import { WorkPage } from './pages/WorkPage'

function Navigation() {
  return (
    <nav className="site-nav" aria-label="Primary">
      {ARC_STEPS.map((item, index) => (
        <NavLink
          key={item.id}
          to={item.route}
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link-active' : 'nav-link'
          }
          end={item.route === '/'}
        >
          <span className="nav-link-index">{index + 1}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <p className="header-title">Navish Kumar</p>
        <p className="header-subtitle">Choose Methods, Case Studies, or Evidence based on what you need to verify.</p>
      </div>
      <Navigation />
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-copy">Research to deployment, designed as one continuous system.</p>
        <div className="footer-links" aria-label="Primary links">
          <a href="/safepatch/">SafePatch demo</a>
          <a href="/bis-continual-process-automation-demo/">BIS demo</a>
          <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en"
            target="_blank"
            rel="noreferrer"
          >
            Google Scholar
          </a>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="content-shell">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/work" element={<WorkPage />} />
          <Route path="/publications" element={<PublicationsPage />} />
          <Route path="/experience" element={<ExperiencePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}
