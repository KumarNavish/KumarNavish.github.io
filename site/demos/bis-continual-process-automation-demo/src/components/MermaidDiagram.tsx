import { useEffect, useRef, useState } from 'react'

interface MermaidDiagramProps {
  title: string
  chart: string
}

let mermaidInitialized = false
let mermaidClient: null | (typeof import('mermaid'))['default'] = null

export function MermaidDiagram({ title, chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const chartId = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setSvg(null)

    const render = async () => {
      try {
        if (!mermaidClient) {
          const mermaidModule = await import('mermaid')
          mermaidClient = mermaidModule.default
        }

        if (!mermaidInitialized && mermaidClient) {
          mermaidClient.initialize({
            startOnLoad: false,
            theme: 'neutral',
            securityLevel: 'strict',
          })
          mermaidInitialized = true
        }

        const output = await mermaidClient?.render(chartId.current, chart)
        if (!cancelled && output) {
          setSvg(output.svg)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [chart])

  return (
    <section className="map-card">
      <h3>{title}</h3>
      {failed ? (
        <pre>{chart}</pre>
      ) : svg ? (
        <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <p className="status">Rendering process map...</p>
      )}
    </section>
  )
}
