import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PublicationsPage } from './pages/PublicationsPage'
import { WorkPage } from './pages/WorkPage'

const NAVIGATION = [
  { href: '/', label: 'Decision Builder' },
  { href: '/work', label: 'Case Studies' },
  { href: '/projects', label: 'Archive' },
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
        <p className="header-subtitle">Research translated into deployable decision systems</p>
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
          <Route path="/proof" element={<Navigate to="/" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/publications" element={<PublicationsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
