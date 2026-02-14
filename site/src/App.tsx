import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { DataPage } from './pages/DataPage'
import { DashboardPage } from './pages/DashboardPage'
import { OpsConsolePage } from './pages/OpsConsolePage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PublicationsPage } from './pages/PublicationsPage'

const NAVIGATION = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/publications', label: 'Publications' },
  { href: '/ops/console', label: 'Ops Console' },
  { href: '/data', label: 'Data' },
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
        <p className="header-title">KumarNavish.github.io</p>
        <p className="header-subtitle">Capability-first portfolio system</p>
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
          <Route path="/publications" element={<PublicationsPage />} />
          <Route path="/ops/console" element={<OpsConsolePage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
