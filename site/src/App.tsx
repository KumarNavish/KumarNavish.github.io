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
      {ARC_STEPS.map((item) => (
        <NavLink
          key={item.id}
          to={item.route}
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link-active' : 'nav-link'
          }
          end={item.route === '/'}
        >
          {item.label}
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
        <p className="header-subtitle">Applied research translated into operational systems</p>
      </div>
      <Navigation />
    </header>
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
    </div>
  )
}
