import { NavLink } from 'react-router-dom'

import './portfolio.css'

export function PortfolioHeader() {
  return (
    <header className="portfolio-header">
      <NavLink className="portfolio-brand" to="/" aria-label="Navish Kumar — research atlas">
        <strong>Navish Kumar</strong>
        <span>Research atlas</span>
      </NavLink>

      <nav className="portfolio-nav" aria-label="Primary navigation">
        <NavLink to="/" end>
          Atlas
        </NavLink>
        <NavLink to="/research/experience-replay-optimization">Research</NavLink>
        <NavLink to="/research/spatial-intelligence">Spatial lab</NavLink>
        <a href="/#contact">Contact</a>
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
        <p className="portfolio-kicker">The natural conclusion</p>
        <h2>Let’s investigate something difficult together.</h2>
        <p>
          Research, machine-learning systems, emerging interfaces, and product work where technical
          depth must become useful.
        </p>
      </div>
      <div className="portfolio-footer-actions">
        <a className="portfolio-button is-primary" href="mailto:navish.kumar@unibas.ch">
          navish.kumar@unibas.ch
        </a>
        <a
          className="portfolio-button"
          href="/artifacts/resume.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Résumé
        </a>
        <a
          className="portfolio-button"
          href="https://github.com/KumarNavish"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  )
}
