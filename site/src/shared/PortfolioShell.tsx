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
  return (
    <header className="portfolio-header">
      <NavLink className="portfolio-brand" to="/" aria-label="Navish Kumar — portfolio home">
        <strong>Navish Kumar</strong>
        <span>ML researcher · systems builder</span>
      </NavLink>

      <nav className="portfolio-nav" aria-label="Primary navigation">
        {NAVIGATION.map(([route, label]) => (
          <NavLink key={route} to={route}>{label}</NavLink>
        ))}
      </nav>

      <a
        className="portfolio-external"
        href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en"
        target="_blank"
        rel="noreferrer"
      >
        Scholar ↗
      </a>
    </header>
  )
}

export function PortfolioFooter() {
  return (
    <footer className="portfolio-footer" id="contact">
      <div>
        <p className="portfolio-kicker">Basel, Switzerland</p>
        <h2>Let’s investigate something difficult together.</h2>
        <p>
          Research, applied machine learning, reliable agents, scientific interfaces, and product
          work where technical depth must become genuinely useful.
        </p>
        <p className="portfolio-footer-interests">
          Current interests: continual adaptation · optimization · evidence-grounded agents ·
          spatial intelligence · research engineering
        </p>
      </div>
      <div className="portfolio-footer-actions" aria-label="Contact and profile links">
        <a className="portfolio-button is-primary" href="mailto:navish.kumar@unibas.ch">
          navish.kumar@unibas.ch
        </a>
        <a className="portfolio-button" href="/artifacts/resume.pdf" target="_blank" rel="noreferrer">
          Résumé
        </a>
        <a className="portfolio-button" href="https://github.com/KumarNavish" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="portfolio-button" href="https://openreview.net/profile?id=~Navish_Kumar1" target="_blank" rel="noreferrer">
          OpenReview
        </a>
        <a className="portfolio-button" href="https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en" target="_blank" rel="noreferrer">
          Google Scholar
        </a>
      </div>
    </footer>
  )
}
