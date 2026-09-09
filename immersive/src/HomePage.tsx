import { useMemo, useState } from "react";
import { Link, useNavigation } from "./navigation";
import { SceneStage, useReducedMotion } from "./components/SceneStage";
import { ScientificPanel } from "./components/ScientificPanel";
import { CanonicalTimeline } from "./components/ResearchStoryBlocks";
import { Icon } from "./components/Icon";
import { EXHIBITS, statusLabel } from "./data/exhibits";
import { narrativeFor } from "./data/workNarrative";
import type { WorkPeriod } from "./data/legacyRegistry";
import type { SceneConfig } from "./engine/renderer";

const HORIZON_COPY: Record<WorkPeriod, { title: string; subtitle: string }> = {
  foundations: { title: "Past", subtitle: "Make hidden structure precise." },
  current: { title: "Now", subtitle: "Understand and constrain change." },
  frontier: { title: "Frontier", subtitle: "Build persistent intelligent interfaces." },
};

const PROOF_IDS = [
  "normalized-gain-laplacians",
  "experience-replay-optimization",
  "rank-feasibility",
  "casepath",
];

export function HomePage() {
  const reduced = useReducedMotion();
  const { go } = useNavigation();
  const [proofId, setProofId] = useState(PROOF_IDS[0]);
  const proof = EXHIBITS.find((e) => e.work.id === proofId)!;
  const narrative = narrativeFor(proof.work.id);
  const config = useMemo<SceneConfig>(
    () => ({ kind: "atlas", step: 4, value: 0, reduced }),
    [reduced],
  );

  return (
    <main id="main" className="home-page comprehension-home">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Intelligent systems.
            <br />
            <span>Seen from within.</span>
          </h1>
          <p className="hero-identity">
            I’m Navish Kumar, a machine-learning researcher and systems builder at the University of Basel.
          </p>
          <p className="hero-description">
            I study what changes inside useful systems—and how to keep the structure, evidence, constraints, and consequences of that change visible.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/trajectory">
              Follow the trajectory <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="/frontier/spatial-intelligence">
              Enter the spatial lab <Icon name="arrow" />
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="small-rule" />
            Research you can inspect, manipulate, and question.
          </div>
        </div>

        <div className="hero-gallery">
          <SceneStage
            config={config}
            description="Three-dimensional research objects spanning structural consistency, learning geometry, and persistent worlds."
            className="home-stage"
            quiet
            callbacks={{
              onPick: (id) => {
                const exhibit = EXHIBITS.find((e) => e.work.id === id);
                if (exhibit) go(exhibit.work.route);
              },
            }}
          />
          <div className="hero-horizons" aria-label="Past, now, and frontier overview">
            {(["foundations", "current", "frontier"] as WorkPeriod[]).map((period) => {
              const works = EXHIBITS.filter((e) => e.work.period === period);
              return (
                <Link key={period} href="/trajectory">
                  <span>{HORIZON_COPY[period].title}</span>
                  <strong>{HORIZON_COPY[period].subtitle}</strong>
                  <small>{works.length} {works.length === 1 ? "work" : "works"}</small>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-journey section-width" aria-labelledby="journey-heading">
        <header className="journey-heading">
          <div>
            <span className="section-label">The canonical trajectory</span>
            <h2 id="journey-heading">Past → Now → Frontier</h2>
          </div>
          <p>
            One body of work, ordered by time. Questions, methods, status, and domains are secondary lenses on this same spine.
          </p>
          <Link className="text-link" href="/trajectory">
            Open the full trajectory <Icon name="arrow" />
          </Link>
        </header>
        <CanonicalTimeline />
      </section>

      <section className="home-proof section-width" aria-labelledby="proof-heading">
        <header className="proof-heading">
          <div>
            <span className="section-label">Understand the contribution through the mechanism</span>
            <h2 id="proof-heading">Change one thing. Watch the consequence propagate.</h2>
          </div>
          <p>
            Each work earns its own scientific object. The visualization is the explanation—not decoration beside it.
          </p>
        </header>

        <div className="proof-selector" role="tablist" aria-label="Choose a defining research explanation">
          {PROOF_IDS.map((id) => {
            const e = EXHIBITS.find((x) => x.work.id === id)!;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={proofId === id}
                onClick={() => setProofId(id)}
              >
                {e.name}
              </button>
            );
          })}
        </div>

        <div className="causal-chain" aria-label="Problem, intervention, consequence, and real-world meaning">
          <article>
            <span>Problem</span>
            <p>{proof.question}</p>
          </article>
          <article>
            <span>Intervention</span>
            <p>{narrative.mechanism}</p>
          </article>
          <article>
            <span>Observable consequence</span>
            <p>{narrative.observableConsequence}</p>
          </article>
          <article>
            <span>So what?</span>
            <p>{narrative.realWorldImplication}</p>
          </article>
        </div>

        <div className="proof-stage" key={proof.work.id}>
          <ScientificPanel exhibit={proof} compact />
          <div className="proof-contribution">
            <span>Navish’s contribution</span>
            <p>{proof.work.contribution}</p>
            <small>{proof.work.role}</small>
            <Link href={proof.work.route}>
              Open the full work <Icon name="arrow" size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="home-current section-width" aria-labelledby="current-heading">
        <header>
          <div>
            <span className="section-label">Now</span>
            <h2 id="current-heading">What is active right now.</h2>
          </div>
          <p>
            Current work stays visibly distinct from published foundations and frontier direction.
          </p>
        </header>
        <div className="current-list">
          {EXHIBITS.filter((e) => e.work.period === "current").map((e) => {
            const n = narrativeFor(e.work.id);
            return (
              <Link key={e.work.id} href={e.work.route}>
                <span>{e.work.year} · {statusLabel(e.work)}</span>
                <h3>{e.name}</h3>
                <p>{n.currentExperiment ?? e.work.nextQuestion}</p>
                <Icon name="arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-atlas-entry section-width">
        <div>
          <span className="section-label">Complete record</span>
          <h2>Ten works. One evolving programme.</h2>
          <p>
            Scan every project, its status, evidence, contribution, and native explanation without turning the homepage into an archive.
          </p>
        </div>
        <Link className="button secondary" href="/work">
          Open the work atlas <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
