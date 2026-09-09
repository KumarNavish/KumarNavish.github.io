import { useMemo } from "react";
import { Link, useNavigation } from "./navigation";
import { SceneStage, useReducedMotion } from "./components/SceneStage";
import { Icon } from "./components/Icon";
import { EXHIBITS, PERIOD_NAMES, statusLabel } from "./data/exhibits";
import type { SceneConfig } from "./engine/renderer";
export function HomePage() {
  const reduced = useReducedMotion(),
    { go } = useNavigation();
  const config = useMemo<SceneConfig>(
    () => ({ kind: "atlas", step: 4, value: 0, reduced }),
    [reduced],
  );
  return (
    <main id="main" className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Intelligent systems.
            <br />
            <span>Seen from within.</span>
          </h1>
          <p className="hero-identity">
            I’m Navish Kumar, a machine-learning researcher and systems builder
            at the University of Basel.
          </p>
          <p className="hero-description">
            I study how systems change—from mathematical structure and continual
            learning to evidence-grounded agents and persistent worlds.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/trajectory">
              Explore the trajectory
              <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="/frontier/spatial-intelligence">
              Enter the spatial lab
              <Icon name="arrow" />
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
            description="Three research objects: gain-graph structure, learning geometry, and a persistent laboratory."
            className="home-stage"
            quiet
            callbacks={{
              onPick: (id) => {
                const e = EXHIBITS.find((x) => x.work.id === id);
                if (e) go(e.work.route);
              },
            }}
          />
          <div className="gallery-captions">
            <Link href="/work/normalized-gain-laplacians">
              <span>Past · 2020–2025</span>
              <strong>Make structure precise.</strong>
            </Link>
            <Link href="/work/experience-replay-optimization">
              <span>Now · current research</span>
              <strong>Understand the update.</strong>
            </Link>
            <Link href="/frontier/spatial-intelligence">
              <span>Next · spatial interfaces</span>
              <strong>Build a persistent world.</strong>
            </Link>
          </div>
        </div>
      </section>
      <section
        className="action-strip"
        aria-label="Three ways to enter the research"
      >
        <Link href="/work/normalized-gain-laplacians">
          <span>01</span>Break a graph’s consistency
          <Icon name="arrow" />
        </Link>
        <Link href="/work/experience-replay-optimization">
          <span>02</span>Watch learning become forgetting
          <Icon name="arrow" />
        </Link>
        <Link href="/work/rank-feasibility">
          <span>03</span>Find room for a correction
          <Icon name="arrow" />
        </Link>
      </section>
      <section className="home-work section-width">
        <div className="section-intro">
          <div>
            <h2>
              Different questions.
              <br />A connected body of work.
            </h2>
          </div>
          <p>
            My early work made local relationships measurable. During the PhD,
            the question became how a useful system can adapt—and how to see
            what that change costs.
          </p>
          <Link className="text-link" href="/work">
            Open the work atlas
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="work-overview">
          {EXHIBITS.map((e, i) => (
            <Link key={e.work.id} href={e.work.route} className="overview-work">
              <span className="work-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <small>
                  {PERIOD_NAMES[e.work.period]} · {e.work.year} ·{" "}
                  {statusLabel(e.work)}
                </small>
                <h3>{e.name}</h3>
                <p>{e.question}</p>
              </div>
              <Icon name="arrow" />
            </Link>
          ))}
        </div>
      </section>
      <section className="closing-note section-width">
        <div>
          <h2>
            From an idea to something
            <br />
            you can actually use.
          </h2>
          <p>
            Mathematical models, experiments, and working interfaces—each with
            its evidence and its limits left visible.
          </p>
        </div>
        <Link className="button secondary" href="/systems">
          See the systems
          <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
