import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { ArtifactsPage } from './pages/ArtifactsPage'
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
  { href: '/artifacts', label: 'Artifacts' },
  { href: '/data', label: 'Data' },
]

const WORKFLOW_BADGES = [
  {
    label: 'CI',
    image:
      'https://github.com/KumarNavish/KumarNavish.github.io/actions/workflows/ci.yml/badge.svg?branch=master',
    link: 'https://github.com/KumarNavish/KumarNavish.github.io/actions/workflows/ci.yml',
  },
  {
    label: 'Pages',
    image:
      'https://github.com/KumarNavish/KumarNavish.github.io/actions/workflows/pages.yml/badge.svg?branch=master',
    link: 'https://github.com/KumarNavish/KumarNavish.github.io/actions/workflows/pages.yml',
  },
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

function WorkflowBadges() {
  return (
    <div className="workflow-badges" aria-label="Automation status">
      {WORKFLOW_BADGES.map((workflow) => (
        <a
          key={workflow.label}
          className="workflow-badge"
          href={workflow.link}
          target="_blank"
          rel="noreferrer"
          title={`${workflow.label} workflow status`}
        >
          <img src={workflow.image} alt={`${workflow.label} workflow status`} />
        </a>
      ))}
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <p className="header-title">KumarNavish.github.io</p>
        <p className="header-subtitle">Capability-first portfolio system</p>
        <WorkflowBadges />
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
          <Route path="/artifacts" element={<ArtifactsPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
