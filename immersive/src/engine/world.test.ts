import { describe, it, expect } from "vitest";
import {
  emptyWorld,
  initialWorld,
  applyCommand,
  moveObject,
  clearObjects,
  agentPath,
  completeAgent,
  blocked,
  validateWorld,
  EXAMPLE,
} from "./world";
describe("Persistent world transactions", () => {
  it("compiles the flagship sentence into objects, relation, and an existing goal", () => {
    const { world, intent } = applyCommand(emptyWorld(), EXAMPLE);
    expect(world.objects.map((o) => o.kind)).toEqual(
      expect.arrayContaining([
        "bench",
        "window",
        "robot",
        "microscope",
        "sample",
      ]),
    );
    expect(intent.move.length).toBe(1);
    expect(world.objects.some((o) => o.id === world.goal?.targetId)).toBe(true);
    expect(validateWorld(world)).toBe(true);
  });
  it("adds a second sample without duplicating referenced objects", () => {
    const w = initialWorld(),
      n = applyCommand(w, "Add a second sample beside the microscope.").world;
    expect(n.objects.length).toBe(w.objects.length + 1);
    expect(n.objects.filter((o) => o.kind === "microscope").length).toBe(1);
    expect(w.objects.every((o) => n.objects.some((p) => p.id === o.id))).toBe(
      true,
    );
  });
  it("moves the existing microscope and preserves unrelated objects", () => {
    const w = initialWorld(),
      n = applyCommand(w, "Move the microscope beside the window.").world;
    const a = w.objects.find((o) => o.kind === "microscope")!,
      b = n.objects.find((o) => o.id === a.id)!;
    expect(b.position).not.toEqual(a.position);
    expect(b.relation?.target).toBe(
      w.objects.find((o) => o.kind === "window")!.id,
    );
    expect(n.objects.filter((o) => o.id !== a.id).map((o) => o.id)).toEqual(
      w.objects.filter((o) => o.id !== a.id).map((o) => o.id),
    );
  });
  it("updates light without losing IDs, coordinates, or history", () => {
    const w = initialWorld(),
      n = applyCommand(w, "Make it night.").world;
    expect(n.time).toBe("night");
    expect(n.objects).toEqual(w.objects);
    expect(n.history.at(-1)?.changed).toContain("lighting");
  });
  it("does not mutate the previous state when a reference is missing", () => {
    const w = emptyWorld(),
      original = JSON.stringify(w);
    expect(() =>
      applyCommand(w, "Add a sample beside the microscope."),
    ).toThrow();
    expect(JSON.stringify(w)).toBe(original);
  });
  it("rejects unrecognized and negated commands rather than fabricating interpretation", () => {
    expect(() =>
      applyCommand(initialWorld(), "Do not remove the microscope."),
    ).toThrow();
    expect(() => applyCommand(initialWorld(), "Teleport a unicorn.")).toThrow();
  });
  it("rejects cyclic relations transactionally", () => {
    const w = initialWorld();
    expect(() =>
      applyCommand(w, "Move the microscope beside the robotic arm."),
    ).toThrow(/circular/);
  });
  it("propagates a moved relation target", () => {
    const w = initialWorld(),
      target = w.objects.find((o) => o.kind === "microscope")!,
      follower = w.objects.find((o) => o.kind === "robot")!;
    const n = moveObject(w, target.id, [
      target.position[0] + 0.4,
      target.position[1],
      target.position[2],
    ]);
    expect(
      n.objects.find((o) => o.id === follower.id)!.position[0],
    ).toBeCloseTo(follower.position[0] + 0.4);
  });
  it("removes dangling relations after target removal", () => {
    const n = applyCommand(initialWorld(), "Remove the microscope.").world;
    expect(n.objects.find((o) => o.kind === "robot")?.relation).toBeUndefined();
  });
  it("clears objects while retaining an auditable history", () => {
    const w = initialWorld(),
      n = clearObjects(w);
    expect(n.objects).toHaveLength(0);
    expect(n.history.at(-1)?.removed).toHaveLength(w.objects.length);
    expect(n.environment).toBe(w.environment);
  });
  it("rejects invalid stored coordinates and repeated object IDs", () => {
    const w = initialWorld();
    const bad = structuredClone(w);
    bad.objects[0].position[0] = NaN;
    expect(validateWorld(bad)).toBe(false);
    const repeated = structuredClone(w);
    repeated.objects.push(repeated.objects[0]);
    expect(validateWorld(repeated)).toBe(false);
  });
  it("keeps the world unchanged when asking what changed", () => {
    const w = applyCommand(initialWorld(), "Make it night").world,
      n = applyCommand(w, "Ask the agent what changed.");
    expect(n.world.revision).toBe(w.revision);
    expect(n.intent.notes.join(" ")).toContain("lighting");
  });
});
describe("Situated agent routing", () => {
  it("finds a collision-free floor path to the initial sample", () => {
    const w = initialWorld(),
      route = agentPath(w, w.goal!.targetId);
    expect(route.length).toBeGreaterThan(1);
    for (const p of route) expect(blocked(w, p[0], p[2])).toBe(false);
  });
  it("does not fabricate a path to a missing target", () =>
    expect(agentPath(initialWorld(), "missing")).toEqual([]));
  it("persists its reached position and records no claim of physical measurement", () => {
    const w = initialWorld(),
      route = agentPath(w, w.goal!.targetId),
      n = completeAgent(w);
    expect(n.agentPosition).toEqual(route.at(-1));
    expect(n.history.at(-1)?.interpretation.notes.join(" ")).toContain(
      "No physical measurement",
    );
  });
});
