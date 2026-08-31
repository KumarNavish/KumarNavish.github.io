import { useState } from 'react'
import { NavLink } from 'react-router-dom'

import './portfolio.css'

const NAVIGATION = [
  ['/trajectory', 'Trajectory'],
  ['/work', 'Work'],
  ['/research', 'Research'],
  ['/systems', 'Systems'],
  ['/frontier', 'Frontier'],
  ['/about', 'About'],
] as const

export function PortfolioHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className={open ? 'portfolio-header is-menu-open' : 'portfolio-header'}>
      <div className="portfolio-header-inner">
        <NavLink className="portfolio-brand" to="/" aria-label="Navish Kumar — portfolio home" onClick={() => setOpen(false)}>
          <strong>Navish Kumar</strong>
          <span>ML research · systems · spatial interfaces</span>
        </NavLink>

        <button
          type="button"
          className="portfolio-menu-toggle"
          aria-expanded={open}
          aria-controls="portfolio-primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span>{open ? 'Close' : 'Menu'}</span>
          <i aria-hidden="true"><b /><b /></i>
        </button>

        <nav id="portfolio-primary-navigation" className="portfolio-nav" aria-label="Primary navigation">
          {NAVIGATION.map(([route, label]) => (
            <NavLink key={route} to={route} onClick={() => setOpen(false)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <a className="portfolio-external" href="mailto:navish.kumar@unibas.ch">
          <span>Contact</span>
          <i aria-hidden="true">↗</i>
        </a>
      </div>
    </header>
  )
}

export function PortfolioFooter() {
  return (
    <footer className="portfolio-footer" id="contact">
      <div className="portfolio-footer-identity">
        <strong>Navish Kumar</strong>
        <span>Basel, Switzerland</span>
        <p>Machine-learning research and systems work across optimisation, continual adaptation, evidence-grounded agents, and spatial intelligence.</p>
      </div>
      <div className="portfolio-footer-links" aria-label="Contact and profile links">
        <a href="mailto:navish.kumar@unibas.ch">Email</a>
        <a href="/artifacts/resume.pdf" target="_blank" rel="noreferrer">Résumé ↗</a>
        <a href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">Scholar ↗</a>
        <a href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">GitHub ↗</a>
        <a href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">OpenReview ↗</a>
      </div>
      <p className="portfolio-footer-note">
        The most useful reason to get in touch is a difficult problem whose method, evidence, system, and interface all matter.
      </p>
    </footer>
  )
}
