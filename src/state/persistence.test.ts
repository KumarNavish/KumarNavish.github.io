import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoryItem } from "../cl/memory";
import type { ContinualComparisonResult } from "../eval/continual_comparison";
import {
  clearDemoState,
  deserializeDemoState,
  loadDemoState,
  saveDemoState,
  serializeDemoState,
  type DemoStateSnapshot,
} from "./persistence";

function makeSnapshot(): DemoStateSnapshot {
  const memoryItem: MemoryItem = {
    id: "mem-1",
    process_id: "incident_escalation",
    risk_tag: "high",
    embedding: new Float32Array([0.1, 0.2, 0.3, 0.4]),
    seen_at: 9,
    payload: { example: { id: "e-1" } },
  };

  const comparison: ContinualComparisonResult = {
    seenProcesses: ["access_request", "incident_escalation"],
    modes: {
      naive: {
        mode: "naive",
        perProcessAccuracy: { access_request: 0.8, incident_escalation: 0.6 },
        forgettingByProcess: { access_request: 0.2, incident_escalation: 0 },
        meanAccuracy: 0.7,
        meanForgetting: 0.1,
        forgettingCurve: [0, 0.1],
      },
      rehearsal: {
        mode: "rehearsal",
        perProcessAccuracy: { access_request: 0.85, incident_escalation: 0.7 },
        forgettingByProcess: { access_request: 0.1, incident_escalation: 0 },
        meanAccuracy: 0.775,
        meanForgetting: 0.05,
        forgettingCurve: [0, 0.05],
      },
      ewc: {
        mode: "ewc",
        perProcessAccuracy: { access_request: 0.86, incident_escalation: 0.72 },
        forgettingByProcess: { access_request: 0.09, incident_escalation: 0 },
        meanAccuracy: 0.79,
        meanForgetting: 0.045,
        forgettingCurve: [0, 0.045],
      },
    },
  };

  return {
    activeTab: "evaluate",
    controls: {
      memoryStrategyId: "risk-aware",
      memoryBudget: 40,
      retrievalK: 4,
      clMode: "ewc",
      driftEnabled: true,
    },
    seenProcesses: ["access_request", "incident_escalation"],
    trainStream: [],
    memoryItems: [memoryItem],
    routerParams: {
      W: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      b: new Float32Array([0.5, 0.6, 0.7, 0.8]),
    },
    ewcState: {
      lambda: 12,
      fisherW: new Float32Array([0.01, 0.02, 0.03, 0.04]),
      fisherB: new Float32Array([0.05, 0.06, 0.07, 0.08]),
      refW: new Float32Array([0.11, 0.12, 0.13, 0.14]),
      refB: new Float32Array([0.15, 0.16, 0.17, 0.18]),
    },
    auditLog: [
      {
        id: 1,
        timestamp: "2026-02-14 00:00:00 UTC",
        action: "bootstrap",
        detail: "initialized",
      },
    ],
    evalSnapshots: [
      {
        id: 1,
        timestamp: "2026-02-14 00:10:00 UTC",
        seenProcesses: ["access_request", "incident_escalation"],
        result: comparison,
      },
    ],
    comparisonResult: comparison,
    inboxRequest: "escalate INC-1001 sev1",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo persistence", () => {
  it("round-trips typed arrays and fields through serialization", () => {
    const input = makeSnapshot();
    const serialized = serializeDemoState(input);
    const restored = deserializeDemoState(serialized);

    expect(restored).not.toBeNull();
    if (!restored) {
      return;
    }

    expect(Array.from(restored.routerParams.W)).toEqual(Array.from(input.routerParams.W));
    expect(Array.from(restored.routerParams.b)).toEqual(Array.from(input.routerParams.b));
    expect(Array.from(restored.memoryItems[0].embedding)).toEqual(
      Array.from(input.memoryItems[0].embedding),
    );
    expect(restored.controls.memoryStrategyId).toBe("risk-aware");
    expect(restored.evalSnapshots).toHaveLength(1);
  });

  it("saves, loads, and clears state from storage", () => {
    const storage = (() => {
      const map = new Map<string, string>();
      return {
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
        removeItem(key: string) {
          map.delete(key);
        },
      };
    })();
    vi.stubGlobal("window", { localStorage: storage });

    const input = makeSnapshot();
    saveDemoState(input);
    const loaded = loadDemoState();
    expect(loaded).not.toBeNull();
    expect(loaded?.activeTab).toBe("evaluate");

    clearDemoState();
    expect(loadDemoState()).toBeNull();
  });
});
