import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import App from './App.tsx'

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Navish Kumar | Interactive Research Atlas',
  '/research/graph-laplacians': 'Gain Graph Laplacians | Navish Kumar',
  '/research/natural-gradient-vi': 'Natural-Gradient Variational Inference | Navish Kumar',
  '/research/experience-replay-optimization': 'Experience Replay as Optimization | Navish Kumar',
  '/research/rank-feasibility': 'Rank Feasibility in Continual PEFT | Navish Kumar',
  '/research/ticlm': 'Time-Continual Language Models | Navish Kumar',
  '/research/urban-logistics': 'Urban Micro-Region Logistics | Navish Kumar',
  '/research/counterspeech': 'Hate and Counterspeech Dynamics | Navish Kumar',
  '/systems/casepath': 'CasePath | Navish Kumar',
  '/research/spatial-intelligence': 'Language to Persistent Worlds | Navish Kumar',
}

export function RoutedApplication() {
  const location = useLocation()

  useEffect(() => {
    document.title = ROUTE_TITLES[location.pathname] ?? 'Navish Kumar | Research Atlas'
    const queryChapter = new URLSearchParams(location.search).get('chapter')
    const targetId = location.hash ? location.hash.slice(1) : queryChapter
    const frame = window.requestAnimationFrame(() => {
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.pathname, location.search])

  return <App />
}
