import { describe, expect, it } from "vitest";
import { EXHIBITS } from "./exhibits";
import { WORK_NARRATIVE } from "./workNarrative";

describe("lifelong work model", () => {
  it("gives every first-class work a causal and real-world narrative", () => {
    const ids = EXHIBITS.map((e) => e.work.id).sort();
    expect(Object.keys(WORK_NARRATIVE).sort()).toEqual(ids);
    for (const e of EXHIBITS) {
      const n = WORK_NARRATIVE[e.work.id];
      expect(e.work.question.length).toBeGreaterThan(20);
      expect(e.work.contribution.length).toBeGreaterThan(30);
      expect(e.work.role.length).toBeGreaterThan(20);
      expect(n.mechanism.length).toBeGreaterThan(30);
      expect(n.observableConsequence.length).toBeGreaterThan(30);
      expect(n.realWorldImplication.length).toBeGreaterThan(30);
      expect(n.physicalExample.length).toBeGreaterThan(30);
    }
  });

  it("keeps the canonical temporal partition complete", () => {
    expect(EXHIBITS.filter((e) => e.work.period === "foundations")).toHaveLength(5);
    expect(EXHIBITS.filter((e) => e.work.period === "current")).toHaveLength(4);
    expect(EXHIBITS.filter((e) => e.work.period === "frontier")).toHaveLength(1);
  });

  it("only references existing works in predecessor and successor links", () => {
    const ids = new Set(EXHIBITS.map((e) => e.work.id));
    for (const n of Object.values(WORK_NARRATIVE)) {
      for (const id of [...n.predecessorIds, ...n.successorIds]) expect(ids.has(id)).toBe(true);
    }
  });
});
