import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { applyTextDrift } from "./drift";
import { validateTargetPlan } from "./target_schema";
import {
  PROCESS_IDS,
  type Example,
  type ProcessDefinition,
  type ProcessId,
  type StreamStep,
} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const DATA_ROOT = path.join(REPO_ROOT, "public", "data");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

describe("step3 dataset validation", () => {
  it("parses process definitions and stream schedule", () => {
    const processesPayload = readJson<{ version: string; processes: ProcessDefinition[] }>(
      path.join(DATA_ROOT, "processes.json"),
    );
    const schedulePayload = readJson<{ version: string; steps: StreamStep[] }>(
      path.join(DATA_ROOT, "stream_schedule.json"),
    );

    expect(processesPayload.version).toBe("1.0");
    expect(schedulePayload.version).toBe("1.0");
    expect(processesPayload.processes).toHaveLength(4);
    expect(schedulePayload.steps).toHaveLength(4);
    expect(new Set(schedulePayload.steps.map((step) => step.process_id))).toEqual(
      new Set(PROCESS_IDS),
    );
  });

  it("validates all train/test targets against process schema rules", () => {
    const { processes } = readJson<{ version: string; processes: ProcessDefinition[] }>(
      path.join(DATA_ROOT, "processes.json"),
    );
    const definitionByProcess = new Map<ProcessId, ProcessDefinition>(
      processes.map((definition) => [definition.process_id, definition]),
    );

    for (const processId of PROCESS_IDS) {
      const trainFile = path.join(DATA_ROOT, "datasets", `${processId}.train.json`);
      const testFile = path.join(DATA_ROOT, "datasets", `${processId}.test.json`);
      const trainExamples = readJson<Example[]>(trainFile);
      const testExamples = readJson<Example[]>(testFile);

      expect(trainExamples).toHaveLength(40);
      expect(testExamples).toHaveLength(20);

      for (const example of [...trainExamples, ...testExamples]) {
        const definition = definitionByProcess.get(processId);
        expect(definition).toBeDefined();
        if (!definition) {
          continue;
        }

        expect(example.process_id).toBe(processId);
        expect(example.target.process_id).toBe(processId);
        expect(example.target.risk_tag).toBe(example.risk_tag);

        const validation = validateTargetPlan(example.target, definition);
        expect(validation.valid, validation.errors.join("; ")).toBe(true);
      }
    }
  });

  it("applies deterministic drift for identical seeds", () => {
    const text = "Please review and approve urgent incident escalation request.";
    const driftA = applyTextDrift(text, { seed: 33, intensity: 1 });
    const driftB = applyTextDrift(text, { seed: 33, intensity: 1 });

    expect(driftA).toBe(driftB);
    expect(driftA).not.toBe(text);
  });
});
