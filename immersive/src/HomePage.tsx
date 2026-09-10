import { useMemo, useState } from "react";
import { Link } from "./navigation";
import { SceneStage, useReducedMotion } from "./components/SceneStage";
import { ScientificPanel } from "./components/ScientificPanel";
import { CanonicalTimeline } from "./components/ResearchStoryBlocks";
import { Icon } from "./components/Icon";
import { EXHIBITS, PERIOD_NAMES, statusLabel } from "./data/exhibits";
import { applyCommand, initialWorld } from "./engine/world";
import type { SceneConfig } from "./engine/renderer";

export function HomePage() {
  const [activeId, setActiveId] = useState("");
  const [world, setWorld] = useState(initialWorld);
  const active = EXHIBITS.find((e) => e.work.id === activeId);
  const reduced = useReducedMotion();
  const worldConfig = useMemo<SceneConfig>(
    () => ({ kind: "world", step: world.revision, value: 0, world, reduced }),
    [world, reduced],
  );

  const selectWork = (id: string) => {
    setActiveId(id);
    requestAnimationFrame(() =>
      document.getElementById("home-work-explanation")?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      }),
    );
  };
  const editWorld = (text: string) =>
    setWorld((current) => applyCommand(current, text).world);

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

        <div id="research-timeline" className="hero-trajectory" aria-label="Complete research trajectory">
          <header>
            <span>One evolving body of work</span>
            <p>Select any project. Its explanation opens in the same place below.</p>
          </header>
          <CanonicalTimeline selected={activeId} onSelect={selectWork} />
        </div>
      </section>

      <section className="home-proof section-width" aria-labelledby="proof-heading">
        <header className="proof-heading">
          <div>
            <span className="section-label">Operate the trajectory</span>
            <h2 id="proof-heading">Every project gets the same way in.</h2>
          </div>
          <p>
            Choose any work in Past, Now, or Frontier. The selected work becomes a guided, computed explanation here; its paper or source record remains the evidence.
          </p>
        </header>

        <div id="home-work-explanation" className="home-work-explanation" aria-live="polite">
          {!active ? (
            <div className="home-selection-prompt">
              <span>10 works · one interaction model</span>
              <h3>Choose any project in the timeline above.</h3>
              <p>
                Nothing is preselected. The work you choose becomes the focus without creating a second project hierarchy.
              </p>
            </div>
          ) : (
            <div className="proof-stage home-selected-work" key={active.work.id}>
              <header className="selected-work-intro">
                <div>
                  <span>
                    {PERIOD_NAMES[active.work.period]} · {active.work.year} · {statusLabel(active.work)}
                  </span>
                  <h3>{active.name}</h3>
                </div>
                <p>{active.question}</p>
                <a href="#research-timeline">Choose another work</a>
              </header>

              {active.work.id === "spatial-intelligence" ? (
                <div className="home-selected-spatial">
                  <SceneStage
                    config={worldConfig}
                    description="A persistent three-dimensional mountain laboratory whose existing objects survive later instructions."
                    quiet
                  />
                  <div className="home-spatial-controls" aria-label="Edit the persistent example world">
                    <button type="button" onClick={() => editWorld("Move the microscope beside the window.")}>Move the microscope</button>
                    <button type="button" onClick={() => editWorld("Add a second sample beside the microscope.")}>Add a sample</button>
                    <button type="button" onClick={() => editWorld("Make it night.")}>Make it night</button>
                    <button type="button" onClick={() => setWorld(initialWorld())}>Reset world</button>
                    <span>{world.objects.length} objects · revision {world.revision}</span>
                  </div>
                  <section className="mechanism-pulse" aria-label="Live causal explanation">
                    <article>
                      <span>Cause</span>
                      <p>{world.history.at(-1)?.text ?? "Start from one typed world with stable object identities."}</p>
                    </article>
                    <article>
                      <span>Measured response</span>
                      <p>{world.objects.length} objects remain in world state · revision {world.revision} · lighting {world.time}.</p>
                    </article>
                    <article>
                      <span>Consequence</span>
                      <p>Later instructions modify the current world instead of replacing the previous scene with an unrelated one.</p>
                    </article>
                  </section>
                </div>
              ) : (
                <ScientificPanel exhibit={active} compact />
              )}

              <div className="proof-contribution">
                <span>Navish’s contribution</span>
                <p>{active.work.contribution}</p>
                <small>{active.work.role}</small>
                <Link href={active.work.route}>
                  Open the full work <Icon name="arrow" size={14} />
                </Link>
              </div>
            </div>
          )}
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
