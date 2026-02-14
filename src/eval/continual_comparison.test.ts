import { describe, expect, it } from "vitest";
import type { Example, ProcessId } from "../domain/types";
import { runContinualComparison } from "./continual_comparison";

function makeExample(processId: ProcessId, idx: number, text: string): Example {
  return {
    id: `${processId}-${idx}`,
    process_id: processId,
    request_text: text,
    risk_tag: processId === "incident_escalation" ? "high" : "medium",
    target: {
      plan_version: "1.0",
      process_id: processId,
      title: `${processId} plan`,
      owner_role: "owner",
      sla_hours: 12,
      risk_tag: processId === "incident_escalation" ? "high" : "medium",
      approvals: ["a"],
      required_fields: { field: "value" },
      next_actions: ["do"],
      controls: ["check"],
    },
  };
}

function buildSet(processId: ProcessId, keyword: string): Example[] {
  const rows: Example[] = [];
  for (let i = 0; i < 30; i += 1) {
    rows.push(makeExample(processId, i, `${keyword} request ${i}`));
  }
  return rows;
}

describe("continual comparison", () => {
  it("shows lower forgetting for rehearsal/ewc versus naive in multi-task setup", () => {
    const seen: ProcessId[] = ["access_request", "purchase_request", "incident_escalation"];
    const trainSets = {
      access_request: buildSet("access_request", "access permission provision"),
      purchase_request: buildSet("purchase_request", "purchase spend budget procurement"),
      incident_escalation: buildSet("incident_escalation", "incident outage escalate sev1"),
    };
    const testSets = trainSets;

    const result = runContinualComparison(seen, trainSets, testSets, "reservoir", 20);

    expect(result.modes.rehearsal.meanForgetting).toBeLessThan(result.modes.naive.meanForgetting);
    expect(result.modes.ewc.meanForgetting).toBeLessThan(result.modes.naive.meanForgetting);
  });
});
