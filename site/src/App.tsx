import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PublicationsPage } from './pages/PublicationsPage'
import { SystemProofPage } from './pages/SystemProofPage'
import { WorkPage } from './pages/WorkPage'

const NAVIGATION = [
  { href: '/', label: 'Overview' },
  { href: '/work', label: 'Case Studies' },
  { href: '/proof', label: 'Practical Value' },
]

function Navigation() {
  return (
    <nav className="site-nav" aria-label="Primary">
      {NAVIGATION.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            isActive ? 'nav-link nav-link-active' : 'nav-link'
          }
          end={item.href === '/'}
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
        <p className="header-subtitle">Research shaped into deployable systems</p>
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
          <Route path="/work" element={<WorkPage />} />
          <Route path="/proof" element={<SystemProofPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/publications" element={<PublicationsPage />} />
          <Route path="/ops/console" element={<Navigate to="/proof" replace />} />
          <Route path="/artifacts" element={<Navigate to="/proof" replace />} />
          <Route path="/data" element={<Navigate to="/proof" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
