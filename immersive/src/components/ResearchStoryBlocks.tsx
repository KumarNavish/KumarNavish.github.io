import { Icon } from "./Icon";
import { Link } from "../navigation";
import { EXHIBITS, PERIOD_NAMES, statusLabel, type Exhibit } from "../data/exhibits";
import { narrativeFor } from "../data/workNarrative";

const PERIODS = ["foundations", "current", "frontier"] as const;
const PERIOD_COPY = {
  foundations: ["Past", "Foundations already established"],
  current: ["Now", "Active research and systems"],
  frontier: ["Frontier", "Deliberate direction"],
} as const;

function workName(id: string) {
  return EXHIBITS.find((e) => e.work.id === id)?.name;
}

export function CanonicalTimeline({ selected = "", onSelect }: { selected?: string; onSelect?: (id: string) => void }) {
  return (
    <section className="canonical-timeline" aria-label="Past, now, and frontier research timeline">
      {PERIODS.map((period) => {
        const works = EXHIBITS.filter((e) => e.work.period === period);
        return (
          <section className={`timeline-period period-${period}`} key={period}>
            <header>
              <h2>{PERIOD_COPY[period][0]}</h2>
              <p>{PERIOD_COPY[period][1]}</p>
            </header>
            <ol>
              {works.map((e) => (
                <li key={e.work.id}>
                  {onSelect ? (
                    <button
                      type="button"
                      aria-pressed={selected === e.work.id}
                      onClick={() => onSelect(e.work.id)}
                    >
                      <span>{e.work.year}</span>
                      <div>
                        <strong>{e.name}</strong>
                        <small>{statusLabel(e.work)}</small>
                      </div>
                      <Icon name="arrow" size={14} />
                    </button>
                  ) : (
                    <Link href={e.work.route}>
                      <span>{e.work.year}</span>
                      <div>
                        <strong>{e.name}</strong>
                        <small>{statusLabel(e.work)}</small>
                      </div>
                      <Icon name="arrow" size={14} />
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </section>
  );
}

export function ProjectCausalSummary({ exhibit }: { exhibit: Exhibit }) {
  const n = narrativeFor(exhibit.work.id);
  return (
    <section className="project-causal-summary" aria-label="Problem, intervention, consequence, and real-world meaning">
      <article>
        <span>Problem</span>
        <p>{exhibit.question}</p>
      </article>
      <article>
        <span>What changed</span>
        <p>{n.mechanism}</p>
      </article>
      <article>
        <span>What becomes observable</span>
        <p>{n.observableConsequence}</p>
      </article>
      <article>
        <span>Why it matters</span>
        <p>{n.realWorldImplication}</p>
      </article>
    </section>
  );
}

export function WorkPosition({ exhibit }: { exhibit: Exhibit }) {
  const n = narrativeFor(exhibit.work.id);
  const before = n.predecessorIds.map(workName).filter(Boolean);
  const after = n.successorIds.map(workName).filter(Boolean);
  return (
    <section className="work-position" aria-label="Position in the research trajectory">
      <div>
        <span>Came from</span>
        {before.length ? before.map((name) => <strong key={name}>{name}</strong>) : <strong>Starting point</strong>}
      </div>
      <div className="is-current">
        <span>This work</span>
        <strong>{exhibit.name}</strong>
      </div>
      <div>
        <span>Leads toward</span>
        {after.length ? after.map((name) => <strong key={name}>{name}</strong>) : <strong>Frontier direction</strong>}
      </div>
    </section>
  );
}

export function TrajectorySelection({ exhibit }: { exhibit: Exhibit }) {
  const n = narrativeFor(exhibit.work.id);
  return (
    <section className="trajectory-selection" aria-live="polite">
      <div>
        <span>{PERIOD_NAMES[exhibit.work.period]} · {exhibit.work.dateLabel} · {statusLabel(exhibit.work)}</span>
        <h2>{exhibit.question}</h2>
      </div>
      <div>
        <span>What this work changes</span>
        <p>{n.mechanism}</p>
        <Link href={exhibit.work.route}>Open the full explanation <Icon name="arrow" size={14} /></Link>
      </div>
    </section>
  );
}
