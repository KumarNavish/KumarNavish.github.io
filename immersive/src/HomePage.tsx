import { useMemo, useState } from "react";
import { Link } from "./navigation";
import { SceneStage, useReducedMotion } from "./components/SceneStage";
import { ScientificPanel } from "./components/ScientificPanel";
import { CanonicalTimeline } from "./components/ResearchStoryBlocks";
import { Icon } from "./components/Icon";
import { EXHIBITS } from "./data/exhibits";
import { initialWorld } from "./engine/world";
import type { SceneConfig } from "./engine/renderer";

const PROOF_IDS = [
  "normalized-gain-laplacians",
  "experience-replay-optimization",
  "rank-feasibility",
  "ticlm-replay-value",
  "casepath",
];

export function HomePage() {
  const [proofId, setProofId] = useState(PROOF_IDS[0]);
  const proof = EXHIBITS.find((e) => e.work.id === proofId)!;
  const reduced = useReducedMotion();
  const world = useMemo(initialWorld, []);
  const worldConfig = useMemo<SceneConfig>(
    () => ({ kind: "world", step: 0, value: 0, world, reduced }),
    [world, reduced],
  );

  return (
    <main id="main" className="home-page comprehension-home clarity-home">
      <section className="hero trajectory-first-hero">
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
            My work moves from mathematical structure, through continual adaptation and evidence-grounded systems, toward persistent spatial interfaces.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/trajectory">
              Follow the trajectory <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="/work">
              Open the complete work <Icon name="arrow" />
            </Link>
          </div>
          <div className="hero-footnote">
            <span className="small-rule" />
            Past → Now → Frontier is the single spine of the site.
          </div>
        </div>

        <div className="hero-trajectory" aria-label="Complete research trajectory">
          <header>
            <span>One evolving body of work</span>
            <p>Every project has a temporal position. Nothing else becomes a competing architecture.</p>
          </header>
          <CanonicalTimeline />
        </div>
      </section>

      <section className="home-proof section-width" aria-labelledby="proof-heading">
        <header className="proof-heading">
          <div>
            <span className="section-label">Operate the idea</span>
            <h2 id="proof-heading">Change one thing. Watch the consequence propagate.</h2>
          </div>
          <p>
            The live object is the explanation: problem → intervention → measured response → real-world meaning. The paper or source record remains the evidence.
          </p>
        </header>

        <div className="proof-selector" role="tablist" aria-label="Choose a defining research explanation">
          {PROOF_IDS.map((id) => {
            const exhibit = EXHIBITS.find((item) => item.work.id === id)!;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={proofId === id}
                onClick={() => setProofId(id)}
              >
                {exhibit.name}
              </button>
            );
          })}
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

      <section className="home-spatial section-width" aria-labelledby="spatial-heading">
        <div className="home-spatial-stage">
          <SceneStage
            config={worldConfig}
            description="A persistent three-dimensional mountain laboratory. The same objects survive the next instruction."
            quiet
          />
        </div>
        <div className="home-spatial-copy">
          <span className="section-label">Frontier · spatial intelligence</span>
          <h2 id="spatial-heading">Language should change a world—not throw the last one away.</h2>
          <p>
            This is where 3D earns its place. A command becomes typed objects, relations, coordinates, revision history, and situated action inside one persistent state.
          </p>
          <ol className="spatial-causal-chain" aria-label="Language to persistent world sequence">
            <li><span>01</span><strong>Say what should exist.</strong></li>
            <li><span>02</span><strong>Inspect the interpreted objects and relations.</strong></li>
            <li><span>03</span><strong>See them occupy persistent world coordinates.</strong></li>
            <li><span>04</span><strong>Edit the same objects with the next instruction.</strong></li>
            <li><span>05</span><strong>Let an agent act on the current revision.</strong></li>
          </ol>
          <Link className="button" href="/frontier/spatial-intelligence">
            Enter the persistent world <Icon name="arrow" />
          </Link>
          <p className="small">
            Real WebGL depth and persistent state; deterministic local parser; no claim of unrestricted scene generation or learned embodiment.
          </p>
        </div>
      </section>

      <section className="home-atlas-entry section-width">
        <div>
          <span className="section-label">Complete record</span>
          <h2>Every project remains inspectable without crowding the main story.</h2>
          <p>
            The work atlas holds the full ten-work record. Publication status, sources, and limitations stay available as evidence layers rather than a second navigation system.
          </p>
        </div>
        <div className="home-record-actions">
          <Link className="button secondary" href="/work">
            Open the work atlas <Icon name="arrow" />
          </Link>
          <Link className="text-link" href="/research">
            Research record <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </main>
  );
}
