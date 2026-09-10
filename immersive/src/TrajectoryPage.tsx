import { useState } from "react";
import { Link } from "./navigation";
import { CanonicalTimeline, TrajectorySelection, WorkPosition } from "./components/ResearchStoryBlocks";
import { Icon } from "./components/Icon";
import { EXHIBITS } from "./data/exhibits";

export function TrajectoryPage() {
  const [selected, setSelected] = useState("");
  const exhibit = EXHIBITS.find((item) => item.work.id === selected);

  return (
    <main id="main" className="trajectory-page page-width trajectory-page-v2">
      <header className="page-heading trajectory-heading">
        <h1>Past → Now → <span>Frontier.</span></h1>
        <p>
          This is the single organizing spine of the portfolio: what was established, what is active now, and what the work is deliberately moving toward.
        </p>
      </header>

      <section className="trajectory-orientation" aria-label="How to read the research trajectory">
        <article>
          <span>Past</span>
          <strong>What did I establish?</strong>
          <p>Interaction structure, gain graphs, spectral bounds, local spatial models, and optimization geometry.</p>
        </article>
        <article className="is-now">
          <span>Now</span>
          <strong>What am I actively trying to resolve?</strong>
          <p>How replay, adaptation capacity, temporal relevance, and evidence obligations constrain change.</p>
        </article>
        <article className="is-frontier">
          <span>Frontier</span>
          <strong>Where is this body of work going?</strong>
          <p>Toward persistent intelligent environments where state, evidence, edits, and actions remain inspectable.</p>
        </article>
      </section>

      <CanonicalTimeline selected={selected} onSelect={setSelected} />

      {exhibit ? (
        <div className="trajectory-selected-v2">
          <WorkPosition exhibit={exhibit} />
          <TrajectorySelection exhibit={exhibit} />
        </div>
      ) : (
        <p className="trajectory-prompt canonical-prompt">
          Select any work above to see what it inherited, what it changed, and what it leads toward.
        </p>
      )}

      <section className="trajectory-record-entry">
        <div>
          <span className="section-label">Secondary lenses</span>
          <h2>Questions, methods, publication status, and evidence do not compete with the timeline.</h2>
          <p>
            They remain available inside the complete work and research records, after the temporal position of each project is already clear.
          </p>
        </div>
        <div>
          <Link className="button secondary" href="/work">
            Open every work <Icon name="arrow" />
          </Link>
          <Link className="text-link" href="/research">
            Audit the research record <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </main>
  );
}
