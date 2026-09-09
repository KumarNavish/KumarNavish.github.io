import { describe, it, expect } from "vitest";
import {
  gainGraph,
  replayExample,
  rankExample,
  temporalExample,
  gaussianExample,
  urbanExample,
  evidenceGate,
  eigenvaluesSymmetric,
} from "./science";
describe("Gain-Laplacian invariants", () => {
  it("diagonalizes a known symmetric matrix", () => {
    const e = eigenvaluesSymmetric([
      [2, 1],
      [1, 2],
    ]);
    expect(e[0]).toBeCloseTo(1, 9);
    expect(e[1]).toBeCloseTo(3, 9);
  });
  for (const normalized of [false, true])
    for (const phase of [0, 0.2, Math.PI / 2, Math.PI])
      it(`preserves Hermitian PSD and trace at phase ${phase}, normalized=${normalized}`, () => {
        const g = gainGraph(phase, normalized);
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            expect(g.re[i][j]).toBeCloseTo(g.re[j][i], 10);
            expect(g.im[i][j]).toBeCloseTo(-g.im[j][i], 10);
          }
        expect(g.eigen[0]).toBeGreaterThanOrEqual(-1e-9);
        expect(g.eigen.reduce((a, b) => a + b, 0)).toBeCloseTo(
          g.re.reduce((v, r, i) => v + r[i], 0),
          8,
        );
        if (normalized) expect(g.eigen[5]).toBeLessThanOrEqual(2 + 1e-8);
      });
  it("detects a defect and restores balance after edge deletion", () => {
    expect(gainGraph(0).eigen[0]).toBeCloseTo(0);
    expect(gainGraph(1).eigen[0]).toBeGreaterThan(0);
    expect(gainGraph(1, false, true).eigen[0]).toBeCloseTo(0);
  });
});
describe("Explicit learning examples", () => {
  it("current-only learning improves the new task and damages the old in the interference fixture", () => {
    const d = replayExample(3, 155);
    expect(d.newAfterCurrent).toBeLessThan(d.newBefore);
    expect(d.oldAfterCurrent).toBeGreaterThan(d.oldBefore);
    expect(d.oldAfterReplay).toBeLessThan(d.oldAfterCurrent);
  });
  it("dense replay reaches the target when all target gradients are available", () => {
    expect(replayExample(3, 155, "dense").residual).toBeCloseTo(0, 12);
  });
  it("a direction-deficient buffer retains a nonzero residual even when dense", () => {
    expect(replayExample(12, 155, "dense", true).residual).toBeGreaterThan(0.2);
  });
  it("rank one is infeasible, two is costly, three is usable", () => {
    expect(rankExample(1, 2).feasible).toBe(false);
    expect(rankExample(2, 2).feasible).toBe(true);
    expect(rankExample(2, 2).usable).toBe(false);
    expect(rankExample(3, 2).usable).toBe(true);
  });
  it("minimum-norm solutions satisfy every original inequality", () => {
    for (const r of [2, 3]) {
      const d = rankExample(r, 2);
      d.a.forEach((a, i) =>
        expect(
          a.reduce((sum, v, k) => sum + v * d.solution![k], 0),
        ).toBeGreaterThanOrEqual(d.b[i] - 1e-8),
      );
    }
  });
  it("charges replay against the fixed current-token budget", () => {
    for (const r of [0, 5, 25, 80]) {
      const d = temporalExample(r, 0.5, 4);
      expect(d.currentTokens + d.oldTokens).toBe(100);
    }
  });
  it("allows beneficial stable replay and zero recommended stale replay", () => {
    expect(temporalExample(25, 0.05, 4).net).toBeGreaterThan(0);
    expect(temporalExample(25, 0.95, 4).recommended).toBe(0);
  });
  it("Gaussian trajectories remain finite and reduce the declared loss", () => {
    for (const a of [1, 5, 12]) {
      const d = gaussianExample(a, 180);
      for (const p of [d.n, d.e]) {
        expect(p.losses.every(Number.isFinite)).toBe(true);
        expect(p.losses.at(-1)!).toBeLessThan(p.losses[0]);
      }
    }
  });
  it("local parking costs can reverse vehicle choice", () => {
    expect(urbanExample(0, 2).winner).toBe("van");
    expect(urbanExample(8, 2).winner).toBe("cargo bike");
  });
});
describe("Synthetic evidence admission", () => {
  const a = { id: "a", field: "inspection-date", value: "20 August" };
  const b = { id: "b", field: "inspection-date", value: "21 August" };
  it("holds a conflict rather than majority voting", () =>
    expect(evidenceGate([a, b]).status).toBe("HOLD"));
  it("requires an explicit superseding record", () => {
    const d = evidenceGate([
      a,
      b,
      {
        id: "c",
        field: "inspection-date",
        value: "20 August",
        supersedes: "b",
      },
    ]);
    expect(d.status).toBe("READY");
    expect(d.superseded).toEqual(["b"]);
  });
  it("keeps an empty obligation unresolved", () =>
    expect(evidenceGate([]).status).toBe("MISSING"));
});
