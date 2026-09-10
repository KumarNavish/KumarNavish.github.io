import { Link } from "./navigation";
import { ScientificPanel } from "./components/ScientificPanel";
import { BackLink } from "./components/Shell";
import { Icon } from "./components/Icon";
import { WorkPosition } from "./components/ResearchStoryBlocks";
import { EXHIBITS, PERIOD_NAMES, statusLabel, type Exhibit } from "./data/exhibits";

function EvidenceSection({ exhibit: e }: { exhibit: Exhibit }) {
  const manuscript = ["experience-replay-optimization", "rank-feasibility"].includes(e.work.id);
  return (
    <section className="work-evidence">
      <div>
        <h2>Go to the source</h2>
        <h3>{e.work.title}</h3>
        <p>{e.work.venue}</p>
        <p className="coauthors">
          Navish Kumar{e.work.coauthors.length ? `, ${e.work.coauthors.join(", ")}` : ""}
        </p>
        <div className="evidence-links">
          {e.work.evidence
            .filter((item) => item.public && item.url.startsWith("https://"))
            .map((item, index) => (
              <a key={index} href={item.url} target="_blank" rel="noreferrer">
                {manuscript ? "Submission source record" : item.label}
                <Icon name="arrow" size={14} />
              </a>
            ))}
        </div>
        {manuscript && (
          <p className="source-disclosure">
            Current review outcome could not be independently retrieved on 9 September 2026. No acceptance or current conference decision is claimed.
          </p>
        )}
      </div>
      <div className="boundary">
        <h2>Where the claim stops</h2>
        <p>{e.work.limitation}</p>
      </div>
    </section>
  );
}

export function ProjectPage({ exhibit: e }: { exhibit: Exhibit }) {
  const next = EXHIBITS[(EXHIBITS.indexOf(e) + 1) % EXHIBITS.length];
  return (
    <main id="main" className="project-page page-width project-page-v2">
      <BackLink />
      <header className="project-heading">
        <div>
          <p className="project-meta">
            {PERIOD_NAMES[e.work.period]} · {e.work.year} · {statusLabel(e.work)}
          </p>
          <h1>{e.question}</h1>
        </div>
        <p>{e.name}</p>
      </header>

      <WorkPosition exhibit={e} />

      <section className="project-live-intro" aria-label="How to understand this work">
        <span>Primary explanation</span>
        <p>Operate the mechanism below. The live measurements show what changed; the source record below shows what the research actually supports.</p>
      </section>
      <ScientificPanel exhibit={e} />

      <section className="project-authorship">
        <span>Navish’s contribution</span>
        <p>{e.work.contribution}</p>
        <small>{e.work.role}</small>
      </section>

      <EvidenceSection exhibit={e} />

      <section className="project-continuation">
        <div>
          <span>The next question</span>
          <p>{e.work.nextQuestion}</p>
        </div>
        <Link href={next.work.route}>
          {next.name}
          <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
