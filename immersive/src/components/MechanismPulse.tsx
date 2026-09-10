import {
  evidenceGate,
  gainGraph,
  gaussianExample,
  rankExample,
  replayExample,
  temporalExample,
  urbanExample,
  type EvidenceSource,
} from "../engine/science";
import type { ScienceState } from "../engine/scientificModels";

const SOURCES: EvidenceSource[] = [
  { id: "source-A", field: "inspection-date", value: "2026-08-20" },
  { id: "source-B", field: "inspection-date", value: "2026-08-21" },
];
const CORRECTION: EvidenceSource = {
  id: "correction-C",
  field: "inspection-date",
  value: "2026-08-20",
  supersedes: "source-B",
};

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;

function pulse(state: ScienceState) {
  if (state.kind === "graph" || state.kind === "frustration") {
    const d = gainGraph((state.value * Math.PI) / 180, !!state.normalized, !!state.repaired);
    return {
      cause: state.repaired
        ? "Remove the highlighted defective relation and recompute the operator."
        : `Rotate one highlighted relationship to ${Math.round(state.value)}° while the graph topology stays fixed.`,
      measured: `Cycle: ${d.balanced ? "balanced" : "unbalanced"} · least eigenvalue ${d.eigen[0].toFixed(3)} · minimum edge repair ${d.frustration}.`,
      consequence: d.balanced
        ? "The finite network again admits a globally consistent assignment."
        : "One local disagreement is now visible as a global spectral change; the spectrum certifies inconsistency without naming a unique repair.",
    };
  }

  if (state.kind === "replay") {
    const d = replayExample(
      state.value,
      state.secondary ?? 155,
      (state.comparison ?? "greedy") as "greedy" | "random" | "dense",
      state.repaired,
    );
    const oldDamage = d.oldAfterCurrent - d.oldBefore;
    const recovered = d.oldAfterCurrent - d.oldAfterReplay;
    return {
      cause: `The current-only update changes the old-task loss by ${signed(oldDamage)}; replay may use ${d.selected.length} of 12 stored gradients.`,
      measured: `With replay, old-task loss changes from ${d.oldAfterCurrent.toFixed(3)} to ${d.oldAfterReplay.toFixed(3)}; correction residual ${d.residual.toFixed(3)}.`,
      consequence:
        recovered > 0
          ? `These memories recover ${recovered.toFixed(3)} old-task loss in this finite example because their aggregate update counters the destructive direction.`
          : "This replay choice does not counter the old-task damage in this example; storing memories is not enough if their update directions are wrong.",
    };
  }

  if (state.kind === "rank") {
    const d = rankExample(state.value, state.secondary ?? 2);
    const result = !d.feasible ? "infeasible" : d.usable ? "feasible inside budget" : "feasible but outside budget";
    return {
      cause: `Restrict the repair to rank ${state.value} with update budget ${(state.secondary ?? 2).toFixed(1)}.`,
      measured: `Minimum correction norm ${d.magnitude === null ? "—" : d.magnitude.toFixed(3)} · ${result}.`,
      consequence: !d.feasible
        ? "No optimizer can find a repair inside this illustrated subspace because the required correction is not expressible there."
        : d.usable
          ? "The expanded adaptation space now contains a repair that also fits the chosen current-task budget."
          : "More rank makes repair possible, but feasibility alone does not make the correction affordable for current learning.",
    };
  }

  if (state.kind === "temporal") {
    const d = temporalExample(state.value, state.secondary ?? 0.8, 4);
    return {
      cause: `${d.oldTokens} historical tokens replace the same number of current tokens under a fixed budget; distribution shift is ${Math.round((state.secondary ?? 0.8) * 100)}%.`,
      measured: `Past ${signed(d.backward)} · present ${signed(d.current)} · forward proxy ${signed(d.forward)} · net replacement value ${signed(d.net)}.`,
      consequence:
        d.net > 0
          ? "History still earns its budget in this transparent scenario: its retention benefit outweighs the displaced-current-data cost."
          : "History has become net inertia in this scenario; zero replay is the rational matched-budget choice rather than a failure to remember.",
    };
  }

  if (state.kind === "urban") {
    const d = urbanExample(state.value, state.secondary ?? 2);
    return {
      cause: `Set the van parking delay to ${state.value.toFixed(1)} min while preserving the same delivery job.`,
      measured: `Van ${d.vanTime.toFixed(2)} min · cargo bike ${d.bikeTime.toFixed(2)} min · faster option: ${d.winner}.`,
      consequence: "A small local operational change can reverse the fleet decision, which is exactly what a city-wide average can hide.",
    };
  }

  if (state.kind === "gaussian") {
    const d = gaussianExample(state.value, 180);
    const natural = d.n.losses[180];
    const euclidean = d.e.losses[180];
    return {
      cause: `Increase target anisotropy to ${state.value.toFixed(1)}× and move the same Gaussian approximation with two geometries.`,
      measured: `Step-180 KL: Fisher flow ${natural.toFixed(3)} · Euclidean flow ${euclidean.toFixed(3)}.`,
      consequence: "The coordinate geometry changes the optimization trajectory; the website comparison remains an illustration, while the paper states the regime in which guarantees hold.",
    };
  }

  if (state.kind === "evidence") {
    const active = state.repaired ? [...SOURCES, CORRECTION] : state.step < 3 ? [SOURCES[0]] : SOURCES;
    const d = evidenceGate(active);
    return {
      cause: state.repaired
        ? "Add an explicit superseding source without deleting the conflicting historical record."
        : state.step < 3
          ? "One bounded source assertion currently supports the inspection date."
          : "Two active sources now assert different inspection dates for the same obligation.",
      measured: `Admission ${d.status} · active sources ${d.active.join(", ")} · superseded ${d.superseded.join(", ") || "none"}.`,
      consequence:
        d.status === "HOLD"
          ? "A plausible interpretation still cannot become permission to act; the evidentiary obligation remains unresolved."
          : state.repaired
            ? "Only the inspection-date obligation and its admission gate need to be replayed; unrelated state remains untouched in this synthetic workflow."
            : "The bounded assertion is currently admissible, but later conflicting evidence can reopen the obligation.",
    };
  }

  return {
    cause: "Change the measurement lens while preserving the same synthetic interaction network.",
    measured: "The displayed network, activity, and language lenses describe the same paired-user population from different viewpoints.",
    consequence: "Observed group differences are descriptive evidence; they do not by themselves establish the effect of an intervention.",
  };
}

export function MechanismPulse({ state }: { state: ScienceState }) {
  const item = pulse(state);
  return (
    <section className="mechanism-pulse" aria-live="polite" aria-label="Live causal explanation">
      <article><span>Cause</span><p>{item.cause}</p></article>
      <article><span>Measured response</span><p>{item.measured}</p></article>
      <article><span>Consequence</span><p>{item.consequence}</p></article>
    </section>
  );
}
