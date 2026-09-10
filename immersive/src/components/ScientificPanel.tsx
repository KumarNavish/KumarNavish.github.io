import { useEffect, useMemo, useRef, useState } from "react";
import type { Exhibit } from "../data/exhibits";
import type { ScienceState } from "../engine/scientificModels";
import { SceneStage, useReducedMotion } from "./SceneStage";
import { Readouts, Matrix, DEMO_SOURCES, CORRECTION } from "./Readouts";
import { evidenceGate } from "../engine/science";
import { Icon } from "./Icon";
import { narrativeFor } from "../data/workNarrative";
import { MechanismPulse } from "./MechanismPulse";
export function downloadJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ScientificPanel({
  exhibit,
  compact = false,
}: {
  exhibit: Exhibit;
  compact?: boolean;
}) {
  const [step, setStep] = useState(0),
    [mode, setMode] = useState<"guide" | "explore" | "evidence">("guide");
  const [playing, setPlaying] = useState(!compact),
    [visible, setVisible] = useState(false);
  const [value, setValue] = useState(exhibit.initial),
    [secondary, setSecondary] = useState(exhibit.secondary);
  const [normalized, setNormalized] = useState(exhibit.kind === "graph");
  const [repaired, setRepaired] = useState(false),
    [comparison, setComparison] = useState("greedy");
  const reduced = useReducedMotion(),
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      (e) => setVisible(e[0]?.isIntersecting ?? false),
      { threshold: 0.15 },
    );
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || reduced || !visible || mode !== "guide") return;
    const timer = setTimeout(() => {
      if (step + 1 < exhibit.steps.length) setStep(step + 1);
      else setPlaying(false);
    }, 5800);
    return () => clearTimeout(timer);
  }, [playing, reduced, visible, mode, step, exhibit.steps.length]);
  const state = useMemo<ScienceState>(() => {
    let v = value,
      sec = secondary,
      repair = repaired;
    if (mode === "guide") {
      if (exhibit.kind === "graph") v = [0, 0, 0, 120, 120, 120][step] ?? 120;
      if (exhibit.kind === "frustration")
        v = [0, 75, 120, 120, 120, 120][step] ?? 120;
      if (exhibit.kind === "frustration" && step === 5) repair = true;
      if (exhibit.kind === "rank") v = [1, 1, 2, 2, 3, 3][step] ?? 3;
      if (exhibit.kind === "temporal") {
        v = [0, 25, 25, 25, 30, 0][step] ?? 0;
        sec = step < 3 ? 0.08 : 0.9;
      }
      if (exhibit.kind === "replay" && step === 5) repair = true;
    }
    return {
      kind: exhibit.kind,
      step:
        mode === "guide"
          ? step
          : exhibit.kind === "network"
            ? Math.round(value)
            : 5,
      value: v,
      secondary: sec,
      normalized,
      repaired: repair,
      comparison,
      reduced,
    };
  }, [
    exhibit,
    step,
    mode,
    value,
    secondary,
    normalized,
    repaired,
    comparison,
    reduced,
  ]);
  const current = exhibit.steps[step];
  const narrative = narrativeFor(exhibit.work.id);
  const jump = (i: number) => {
    setPlaying(false);
    setMode("guide");
    setStep(Math.max(0, Math.min(exhibit.steps.length - 1, i)));
  };
  const switchMode = (m: typeof mode) => {
    setPlaying(false);
    if (m === "explore") {
      setValue(state.value);
      setSecondary(state.secondary ?? secondary);
      setRepaired(!!state.repaired);
    }
    setMode(m);
  };
  const correct = () => {
    setRepaired(true);
    setPlaying(false);
    setStep(exhibit.steps.length - 1);
  };
  return (
    <div
      className={`scientific-panel ${compact ? "is-compact" : ""}`}
      ref={root}
      data-work-id={exhibit.work.id}
    >
      <div className="instrument-nav" aria-label="Explanation mode">
        {(
          [
            ["guide", "Guided"],
            ["explore", "Explore"],
            ["evidence", "Evidence"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={mode === key}
            onClick={() => switchMode(key)}
          >
            {label}
          </button>
        ))}
        <span>
          {mode === "guide"
            ? `${String(step + 1).padStart(2, "0")} / ${String(exhibit.steps.length).padStart(2, "0")}`
            : "Computed example"}
        </span>
      </div>
      {mode === "explore" && (
        <div className="instrument-controls">
          {exhibit.kind !== "evidence" && (
            <label>
              <span>
                {exhibit.primaryLabel}
                <output>
                  {value}
                  {exhibit.unit}
                </output>
              </span>
              <input
                type="range"
                min={exhibit.min}
                max={exhibit.max}
                step={exhibit.kind === "temporal" ? 5 : 1}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </label>
          )}
          {(exhibit.kind === "graph" || exhibit.kind === "frustration") && (
            <label>
              <span>Operator</span>
              <select
                value={normalized ? "normalized" : "combinatorial"}
                onChange={(e) => setNormalized(e.target.value === "normalized")}
              >
                <option value="normalized">Normalized</option>
                <option value="combinatorial">Combinatorial</option>
              </select>
            </label>
          )}
          {exhibit.kind === "frustration" && (
            <button
              className="button secondary"
              aria-pressed={repaired}
              onClick={() => setRepaired((v) => !v)}
            >
              {repaired ? "Restore the edge" : "Remove the defective edge"}
            </button>
          )}
          {exhibit.kind === "replay" && (
            <>
              <label>
                <span>
                  Task angle<output>{secondary}°</output>
                </span>
                <input
                  type="range"
                  min="20"
                  max="180"
                  value={secondary}
                  onChange={(e) => setSecondary(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Replay selection</span>
                <select
                  value={comparison}
                  onChange={(e) => setComparison(e.target.value)}
                >
                  <option value="greedy">Greedy illustration</option>
                  <option value="random">Fixed random subset</option>
                  <option value="dense">Dense replay</option>
                </select>
              </label>
              <label className="check-control">
                <input
                  type="checkbox"
                  checked={repaired}
                  onChange={(e) => setRepaired(e.target.checked)}
                />
                Restrict the buffer directions
              </label>
            </>
          )}
          {exhibit.kind === "rank" && (
            <label>
              <span>
                Update budget<output>{secondary.toFixed(1)}</output>
              </span>
              <input
                type="range"
                min="0.5"
                max="8"
                step="0.1"
                value={secondary}
                onChange={(e) => setSecondary(Number(e.target.value))}
              />
            </label>
          )}
          {exhibit.kind === "temporal" && (
            <label>
              <span>
                Distribution shift
                <output>
                  {secondary < 0.3
                    ? "Stable"
                    : secondary < 0.65
                      ? "Changing"
                      : "Rapidly changing"}
                </output>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={secondary}
                onChange={(e) => setSecondary(Number(e.target.value))}
              />
            </label>
          )}
          {exhibit.kind === "evidence" && (
            <button
              className="button secondary"
              onClick={() => setRepaired((v) => !v)}
            >
              {repaired
                ? "Reopen the conflicting state"
                : "Apply the superseding correction"}
            </button>
          )}
        </div>
      )}
      <div className="science-layout">
        <div className="science-visual">
          <SceneStage config={state} description={current.notice} />
          <Readouts state={state} />
          <MechanismPulse state={state} />
        </div>
        <aside className="science-story">
          <div className="story-step" aria-live="polite">
            <span>
              {mode === "guide" ? "Follow the idea" : "The mechanism"}
            </span>
            <h2>{mode === "guide" ? current.title : exhibit.question}</h2>
            <p>
              {mode === "guide" ? current.body : exhibit.work.explanation15}
            </p>
          </div>
          {(mode !== "guide" || step === exhibit.steps.length - 1) && (
            <div className="story-meaning">
              <div><span>Observable effect</span><p>{narrative.observableConsequence}</p></div>
              <div><span>Real-world meaning</span><p>{narrative.realWorldImplication}</p></div>
            </div>
          )}
          {exhibit.kind === "evidence" && (
            <div className="source-excerpts">
              <article>
                <span>Source A · synthetic</span>
                <p>
                  Inspection date: <strong>20 August 2026</strong>
                </p>
              </article>
              {(state.step >= 3 || state.repaired) && (
                <article
                  className={state.repaired ? "superseded" : "source-conflict"}
                >
                  <span>
                    Source B{state.repaired ? " · superseded" : " · synthetic"}
                  </span>
                  <p>
                    Inspection date: <strong>21 August 2026</strong>
                  </p>
                </article>
              )}
              {state.repaired && (
                <article className="source-corrected">
                  <span>Correction C · supersedes B</span>
                  <p>
                    Inspection date: <strong>20 August 2026</strong>
                  </p>
                </article>
              )}
              {!state.repaired && state.step >= 3 && (
                <button className="button" onClick={correct}>
                  Apply superseding correction
                  <Icon name="arrow" />
                </button>
              )}
            </div>
          )}
          {exhibit.kind === "evidence" && state.repaired && (
            <div className="case-replay-trace" aria-label="Scoped replay after correction">
              <span>Scoped replay</span>
              <ol>
                <li><strong>Source state</strong><small>B becomes historical; C becomes current.</small></li>
                <li><strong>Dependent obligation</strong><small>The inspection-date check is recomputed.</small></li>
                <li><strong>Admission gate</strong><small>The packet returns to READY for human review.</small></li>
                <li><strong>Unrelated state</strong><small>Nothing else is rewritten in this synthetic example.</small></li>
              </ol>
            </div>
          )}
          <div
            className="story-transport"
            aria-label="Guided explanation controls"
          >
            <button
              aria-label="Previous explanation step"
              disabled={step === 0}
              onClick={() => jump(step - 1)}
            >
              <Icon name="back" />
            </button>
            <button
              className="play-control"
              disabled={reduced}
              aria-label={playing ? "Pause explanation" : "Play explanation"}
              onClick={() => {
                setMode("guide");
                if (step === exhibit.steps.length - 1) setStep(0);
                setPlaying((v) => !v);
              }}
            >
              <Icon name={playing && !reduced ? "pause" : "play"} />
              {reduced ? "Step mode" : playing ? "Pause" : "Play"}
            </button>
            <button
              aria-label="Next explanation step"
              disabled={step === exhibit.steps.length - 1}
              onClick={() => jump(step + 1)}
            >
              <Icon name="next" />
            </button>
            <button
              aria-label="Restart explanation"
              onClick={() => {
                setRepaired(false);
                jump(0);
              }}
            >
              <Icon name="reset" />
            </button>
          </div>
          <ol className="story-index">
            {exhibit.steps.map((item, i) => (
              <li key={item.title}>
                <button
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => jump(i)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {item.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <p className="model-note">
        <span>About this visualization</span>
        {exhibit.modelNote}
      </p>
      {mode === "evidence" && (
        <section className="formal-panel">
          <div>
            <h3>The formal object</h3>
            <code>{exhibit.formula}</code>
            {(exhibit.kind === "graph" || exhibit.kind === "frustration") && (
              <Matrix state={state} />
            )}
          </div>
          <div>
            <h3>What the example cannot establish</h3>
            <p>{exhibit.work.limitation}</p>
            <p className="small">
              Website simulations are not substituted for empirical research
              results.
            </p>
          </div>
          {exhibit.kind === "evidence" && (
            <button
              className="button secondary"
              onClick={() =>
                downloadJSON(
                  {
                    sources: state.repaired
                      ? [...DEMO_SOURCES, CORRECTION]
                      : DEMO_SOURCES,
                    gate: evidenceGate(
                      state.repaired
                        ? [...DEMO_SOURCES, CORRECTION]
                        : DEMO_SOURCES,
                    ),
                    scope:
                      "Synthetic consistency demonstration; human review required",
                  },
                  "casepath-review-state.json",
                )
              }
            >
              <Icon name="download" />
              Export review state
            </button>
          )}
        </section>
      )}
    </div>
  );
}
