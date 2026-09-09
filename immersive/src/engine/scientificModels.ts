import * as T from "three";
import {
  arrow,
  box,
  cylinder,
  sphere,
  rod,
  line,
  tube,
  label,
  surface,
  platform,
  grid,
  mesh,
  C,
  type Model,
} from "./primitives";
import {
  gainGraph,
  GRAPH_EDGES,
  replayExample,
  rankExample,
  temporalExample,
  gaussianExample,
  type V3,
} from "./science";
import { miniatureWorld, pine } from "./worldModels";
export type ScienceKind =
  | "graph"
  | "frustration"
  | "replay"
  | "rank"
  | "temporal"
  | "gaussian"
  | "urban"
  | "network"
  | "evidence"
  | "atlas"
  | "trajectory";
export type ScienceState = {
  kind: ScienceKind;
  step: number;
  value: number;
  secondary?: number;
  normalized?: boolean;
  repaired?: boolean;
  comparison?: string;
  selected?: string;
  reduced?: boolean;
};
export function graphModel(s: ScienceState): Model {
  const group = new T.Group(),
    phase = (s.value * Math.PI) / 180,
    calculated = gainGraph(phase, !!s.normalized, !!s.repaired);
  const positions: V3[] = Array.from({ length: 6 }, (_, i) => [
    2.3 * Math.cos((i * Math.PI) / 3),
    0.6,
    2.3 * Math.sin((i * Math.PI) / 3),
  ]);
  group.add(platform(7, 7));
  GRAPH_EDGES.forEach(([i, j], k) => {
    if (s.repaired && k === 0) return;
    const color = k === 0 && !calculated.balanced ? C.warm : 0x83929e;
    group.add(rod(positions[i], positions[j], k === 0 ? 0.053 : 0.026, color));
    const midpoint = positions[i].map(
      (v, k) => (v + positions[j][k]) / 2,
    ) as V3;
    if (k === 0) {
      const phasor = new T.Group();
      phasor.position.set(midpoint[0], 1.2, midpoint[2]);
      const dial = mesh(new T.TorusGeometry(0.45, 0.014, 8, 64), C.gray);
      phasor.add(
        dial,
        arrow(
          [0, 0, 0],
          [0.43 * Math.cos(phase), 0.43 * Math.sin(phase), 0],
          C.warm,
          0.019,
        ),
      );
      group.add(phasor);
    }
  });
  positions.forEach((p, i) => {
    group.add(
      sphere(0.19, i < 2 && !calculated.balanced ? C.warm : C.blue, p),
      cylinder(0.07, 0.53, 0xd5dee4, [p[0], 0.255, p[2]]),
      label(String(i + 1), [p[0], 0.98, p[2]], 0.24),
    );
  });
  if (s.step >= 3 || s.kind === "frustration") {
    calculated.eigen.forEach((v, i) => {
      const h = Math.max(0.035, v * 0.35),
        x = -1.75 + i * 0.68;
      group.add(
        cylinder(0.105, h, i === 0 ? C.warm : C.blue, [x, h / 2, 3]),
        label(v.toFixed(2), [x, h + 0.26, 3], 0.19),
      );
    });
    group.add(
      label(
        s.normalized ? "Normalized eigenvalues" : "Laplacian eigenvalues",
        [0, -0.05, 3.65],
        0.24,
      ),
    );
  }
  if (s.step < 3)
    group.add(
      label(
        calculated.balanced
          ? "The cycle closes"
          : "One relationship no longer agrees",
        [0, 2.15, 0],
        0.3,
        calculated.balanced ? "#315fe8" : "#ae5135",
      ),
    );
  const traveller = sphere(0.075, C.warm, positions[0]);
  group.add(traveller);
  return {
    group,
    update: (seconds) => {
      if (s.reduced || s.step === 0) return false;
      const t = Math.max(0, Math.min(1, seconds / 3)),
        f = t * 6,
        i = Math.min(5, Math.floor(f)),
        a = positions[i],
        b = positions[(i + 1) % 6],
        u = f - i;
      traveller.position.set(
        a[0] + (b[0] - a[0]) * u,
        0.62,
        a[2] + (b[2] - a[2]) * u,
      );
      return t < 1;
    },
  };
}
export function replayModel(s: ScienceState): Model {
  const group = new T.Group(),
    data = replayExample(
      s.value,
      s.secondary ?? 155,
      (s.comparison ?? "greedy") as "greedy" | "random" | "dense",
      !!s.repaired,
    ),
    height = (x: number, z: number) =>
      0.075 *
      ((x - data.currentCenter[0]) ** 2 +
        (z - data.currentCenter[1]) ** 2 +
        (x - data.oldCenter[0]) ** 2 +
        (z - data.oldCenter[1]) ** 2);
  group.add(grid(8, 20));
  const landscape = surface(height, 0xb8cfed, 7.6, 56);
  group.add(landscape);
  const outline = new T.LineSegments(
    new T.WireframeGeometry(landscape.geometry),
    new T.LineBasicMaterial({
      color: 0x7797c0,
      transparent: true,
      opacity: 0.17,
    }),
  );
  group.add(outline);
  const start: V3 = [data.w[0], 3, data.w[1]],
    current: V3 = [data.currentOnly[0], 3, data.currentOnly[1]],
    ideal: V3 = [data.ideal[0], 3, data.ideal[1]],
    actual: V3 = [data.corrected[0], 3, data.corrected[1]];
  if (s.step >= 1)
    group.add(
      sphere(0.13, C.ink, start),
      rod([data.w[0], height(...data.w), data.w[1]], start, 0.012, C.gray),
    );
  if (s.step >= 1)
    group.add(
      arrow(start, current, C.warm, 0.04),
      label(
        "Current only",
        [current[0] + 0.3, 3.48, current[2]],
        0.27,
        "#a35135",
      ),
    );
  if (s.step >= 2)
    group.add(
      arrow(start, ideal, C.cyan, 0.04),
      label(
        "Joint-training target",
        [ideal[0] - 0.5, 3.85, ideal[2]],
        0.27,
        "#237a7b",
      ),
    );
  if (s.step >= 3)
    data.gradients.forEach((v, i) => {
      const active = data.selected.includes(i) && s.step >= 4;
      group.add(
        arrow(
          start,
          [start[0] - 0.3 * v[0], 3, start[2] - 0.3 * v[1]],
          active ? C.blue : C.gray,
          active ? 0.022 : 0.009,
        ),
      );
    });
  if (s.step >= 4) {
    group.add(
      arrow(start, actual, C.blue, 0.046),
      sphere(0.115, C.blue, actual),
      line([actual, ideal], C.warm),
      label("Replay update", [actual[0], 2.65, actual[2]], 0.25, "#315fe8"),
    );
  }
  group.add(label("Joint quadratic loss", [0, 0.15, -3.65], 0.25));
  const ball = sphere(0.13, s.step >= 4 ? C.blue : C.warm, [
    data.w[0],
    height(...data.w) + 0.14,
    data.w[1],
  ]);
  group.add(ball);
  return {
    group,
    update: (seconds) => {
      const t = s.reduced ? 1 : Math.min(1, seconds / 1.3),
        e = 1 - (1 - t) ** 3,
        end =
          s.step >= 4
            ? data.corrected
            : s.step >= 1
              ? data.currentOnly
              : data.w;
      const x = data.w[0] + (end[0] - data.w[0]) * e,
        z = data.w[1] + (end[1] - data.w[1]) * e;
      ball.position.set(x, height(x, z) + 0.14, z);
      return t < 1;
    },
  };
}
export function rankModel(s: ScienceState): Model {
  const group = new T.Group(),
    r = Math.round(s.value),
    budget = s.secondary ?? 2,
    data = rankExample(r, budget);
  group.add(grid(12, 24));
  group.add(
    arrow([-3, 0, 0], [3, 0, 0], C.ink, 0.023),
    label("channel 1", [3.25, 0.3, 0], 0.22),
  );
  if (r >= 2) {
    group.add(
      arrow([0, 0, -2], [0, 0, 7.2], C.blue, 0.023),
      label("channel 2", [0, 0.3, 7.5], 0.22),
    );
    const p = box([6, 0.014, 9], 0x7bade9, [0, -0.035, 2.5], 0.2);
    group.add(p);
  }
  if (r >= 3) {
    group.add(
      arrow([0, 0, 0], [0, 4, 0], C.cyan, 0.023),
      label("channel 3", [0, 4.4, 0], 0.22),
    );
    const volume = box([4, 3, 4], 0x7bbdc4, [0, 1.5, 0], 0.08);
    group.add(volume);
    group.add(
      new T.LineSegments(
        new T.EdgesGeometry(volume.geometry),
        new T.LineBasicMaterial({
          color: C.cyan,
          transparent: true,
          opacity: 0.22,
        }),
      ).translateY(1.5),
    );
  }
  const envelope = new T.Mesh(
    new T.SphereGeometry(budget, 24, 12),
    new T.MeshBasicMaterial({
      color: C.gray,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    }),
  );
  group.add(
    envelope,
    label("Update budget", [budget, 0.28, -budget * 0.4], 0.24),
  );
  if (data.solution) {
    group.add(
      arrow([0, 0, 0], data.position, data.usable ? C.blue : C.warm, 0.06),
      sphere(0.19, data.usable ? C.blue : C.warm, data.position),
      label(
        data.usable ? "Feasible and within budget" : "Feasible, but too large",
        [data.position[0], data.position[1] + 0.6, data.position[2]],
        0.27,
      ),
    );
  } else {
    group.add(
      sphere(0.15, C.warm, [1.5, 0.1, 0]),
      sphere(0.15, C.warm, [-1.5, 0.1, 0]),
      arrow([0.3, 0.3, 0], [1.7, 0.3, 0], C.warm, 0.035),
      arrow([-0.3, 0.3, 0], [-1.7, 0.3, 0], C.warm, 0.035),
      label("Opposing requirements; no solution", [0, 1.1, 0], 0.29, "#aa5237"),
    );
  }
  return { group };
}
export function temporalModel(s: ScienceState): Model {
  const group = new T.Group(),
    replay = s.value,
    d = temporalExample(replay, s.secondary ?? 0.8, 4);
  group.add(platform(10, 6));
  for (let w = 0; w < 6; w++) {
    const x = -4 + w * 1.6,
      h = 0.45 + w * 0.12;
    group.add(
      box([1.1, h, 1.5], w === 5 ? C.blue : 0xb5c5d6, [x, h / 2, -0.9]),
      label(w === 5 ? "Now" : `Window ${w + 1}`, [x, h + 0.38, -0.9], 0.23),
    );
    if (w < 5 && s.step >= 2) {
      const alpha = Math.max(0.1, 1 - ((s.secondary ?? 0.8) * (5 - w)) / 5);
      const arc = tube(
        [
          [x, h, -0.5],
          [x, 0.6 + h, 1],
          [4, 1.5, 1],
          [4, 0.8, -0.5],
        ],
        w < 3 ? C.warm : C.cyan,
        0.018,
      );
      arc.traverse((o) => {
        const m = o as T.Mesh;
        if (m.material) {
          (m.material as T.Material).transparent = true;
          (m.material as T.Material).opacity = alpha;
        }
      });
      group.add(arc);
    }
  }
  for (let i = 0; i < 20; i++)
    group.add(
      box([0.38, 0.19, 0.44], i < Math.round(replay / 5) ? C.warm : C.blue, [
        -3.95 + i * 0.42,
        0.1,
        2,
      ]),
    );
  group.add(
    label(
      "100 tokens · replacement, never extra compute",
      [0, 0.65, 2.55],
      0.28,
    ),
  );
  if (s.step >= 3)
    d.weights.forEach((v, i) => {
      const h = Math.abs(v) * 3 + 0.015,
        x = -2 + i * 2;
      group.add(
        box([0.7, h, 0.65], v <= 0 ? C.cyan : C.warm, [x, h / 2, 3.5]),
        label(["Past", "Present", "Forward proxy"][i], [x, -0.18, 3.5], 0.21),
        label(`${v > 0 ? "+" : ""}${v.toFixed(3)}`, [x, h + 0.32, 3.5], 0.22),
      );
    });
  return { group };
}
export function gaussianModel(s: ScienceState): Model {
  const group = new T.Group(),
    d = gaussianExample(s.value, 180);
  group.add(grid(7, 18));
  const h = (x: number, z: number) => 0.055 * (s.value * x * x + z * z),
    landscape = surface(h, 0xc6d4e9, 6.2);
  group.add(landscape);
  const wire = new T.LineSegments(
    new T.WireframeGeometry(landscape.geometry),
    new T.LineBasicMaterial({
      color: 0x8ca5c4,
      transparent: true,
      opacity: 0.15,
    }),
  );
  group.add(wire);
  for (let level = 1; level <= 4; level++) {
    const points: V3[] = Array.from({ length: 101 }, (_, i) => {
      const a = (i / 100) * Math.PI * 2;
      return [
        (Math.cos(a) * level * 0.55) / Math.sqrt(s.value),
        0.025,
        Math.sin(a) * level * 0.55,
      ];
    });
    group.add(line(points, C.ink, 0.3));
  }
  const nat = d.natural.map((p) => [p[0], p[1] + 0.14, p[2]] as V3),
    eu = d.euclidean.map((p) => [p[0], p[1] + 0.16, p[2]] as V3);
  group.add(tube(nat, C.blue, 0.025), tube(eu, C.warm, 0.022));
  const n = sphere(0.1, C.blue),
    e = sphere(0.085, C.warm);
  group.add(
    n,
    e,
    label("Fisher geometry", [-1.4, 1.3, -1], 0.28, "#315fe8"),
    label("Euclidean coordinates", [1.6, 0.5, 2.6], 0.26, "#ac5237"),
  );
  return {
    group,
    update: (seconds) => {
      const t = s.reduced ? 1 : Math.min(1, seconds / 4),
        i = Math.round(t * 180);
      n.position.set(...nat[i]);
      e.position.set(...eu[i]);
      return t < 1;
    },
  };
}
export function networkModel(s: ScienceState): Model {
  const group = new T.Group();
  const points: V3[] = [];
  group.add(platform(9, 6));
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.399;
    const x = (i < 8 ? -2 : 2) + Math.cos(angle) * 1.25;
    const y = 0.4 + (s.step > 1 ? (i % 3) * 0.3 : 0);
    const z = Math.sin(angle) * 1.45;
    points.push([x, y, z]);
    group.add(sphere(0.13, i < 8 ? C.warm : C.blue, [x, y, z]));
  }
  for (let i = 0; i < 16; i++) {
    const j = i < 8 ? (i + 1) % 8 : 8 + ((i + 2) % 8);
    group.add(rod(points[i], points[j], 0.018, C.gray));
    if (s.step > 0 && i % 3 === 0)
      group.add(rod(points[i], points[(i + 8) % 16], 0.013, C.gray));
  }
  group.add(label("Paired user groups", [0, 2.3, 0], 0.3));
  group.add(label("Synthetic interaction graph", [0, 0.2, 2.8], 0.24));
  return { group };
}
function vehicle(bike: boolean) {
  const g = new T.Group();
  if (bike) {
    for (const x of [-0.25, 0.25])
      g.add(mesh(new T.TorusGeometry(0.14, 0.028, 8, 16), C.ink, [x, 0.15, 0]));
    g.add(rod([-0.25, 0.15, 0], [0, 0.4, 0], 0.023, C.blue));
    g.add(rod([0, 0.4, 0], [0.25, 0.15, 0], 0.023, C.blue));
    g.add(rod([-0.25, 0.15, 0], [0.25, 0.15, 0], 0.023, C.blue));
    g.add(box([0.3, 0.24, 0.3], C.warm, [-0.27, 0.43, 0]));
    g.add(rod([0.15, 0.45, 0], [0.32, 0.45, 0], 0.025, C.ink));
  } else {
    g.add(box([0.85, 0.45, 0.4], C.white, [0, 0.34, 0]));
    g.add(box([0.22, 0.17, 0.42], 0x85a3b6, [0.29, 0.45, 0]));
    for (const x of [-0.28, 0.28])
      for (const z of [-0.22, 0.22]) {
        const w = cylinder(0.1, 0.07, C.ink, [x, 0.12, z]);
        w.rotation.x = Math.PI / 2;
        g.add(w);
      }
  }
  return g;
}
export function urbanModel(s: ScienceState): Model {
  const group = new T.Group();
  group.add(platform(11, 7));
  for (let district = 0; district < 2; district++) {
    const x = district ? 2.8 : -2.8;
    const tile = mesh(new T.CylinderGeometry(2.7, 2.7, 0.16, 6), 0xe3eae7, [
      x,
      -0.04,
      0,
    ]);
    group.add(tile);
    group.add(box([4.5, 0.03, 0.55], 0xb3c1c5, [x, 0.055, 1]));
    group.add(box([0.48, 0.03, 4.2], 0xb3c1c5, [x, 0.055, 0]));
    for (let i = 0; i < 9; i++) {
      const bx = x - 1.6 + (i % 3) * 1.25,
        bz = -1.4 + Math.floor(i / 3) * 0.84;
      if (Math.abs(bx - x) < 0.4) continue;
      const h = district ? 0.45 + (i % 2) * 0.2 : 0.55 + (i % 4) * 0.42;
      group.add(
        box([0.65, h, 0.55], district ? 0xbfcbbf : 0xb7c5d1, [
          bx,
          h / 2 + 0.07,
          bz,
        ]),
      );
      group.add(box([0.7, 0.045, 0.6], C.white, [bx, h + 0.09, bz]));
    }
    const plant = pine(0.48);
    plant.position.set(x + 1.6, 0.1, 1.8);
    group.add(plant);
  }
  group.add(label("Dense centre", [-2.8, 2.9, 0], 0.3));
  group.add(label("Open neighbourhood", [2.8, 2.5, 0], 0.3));
  const van = vehicle(false),
    bike = vehicle(true);
  van.position.set(-4, 0.07, 1.02);
  bike.position.set(1.8, 0.07, 1.04);
  group.add(van, bike);
  return {
    group,
    update: (seconds) => {
      if (s.reduced || s.step < 2) return false;
      const t = Math.min(1, seconds / 5);
      van.position.x = -4 + 2.7 * Math.min(1, t / (0.55 + s.value / 10));
      bike.position.x = 1.7 + 2.7 * Math.min(1, t / 0.8);
      return t < 1;
    },
  };
}
export function evidenceModel(s: ScienceState): Model {
  const group = new T.Group(),
    ready = !!s.repaired,
    hold = s.step >= 3 && !ready;
  group.add(platform(11, 6));
  for (let i = 0; i < 2; i++) {
    group.add(box([1.7, 0.1, 2.1], C.white, [-3.5, 0.15, (-1 + i * 2) * 1.25]));
    for (let j = 0; j < 5; j++) {
      const color = j === 2 && !ready && i === 1 ? C.warm : 0xbcc6ce;
      group.add(
        box([j === 0 ? 1.1 : 1.35, 0.012, 0.07], color, [
          -3.5,
          0.211,
          -1.92 + i * 2.5 + j * 0.3,
        ]),
      );
    }
    group.add(
      label(`Source ${i ? "B" : "A"}`, [-3.5, 0.55, -1.25 + i * 2.5], 0.25),
    );
  }
  group.add(sphere(0.22, C.blue, [-0.8, 0.7, 0]));
  group.add(
    tube(
      [
        [-2.6, 0.22, -1.2],
        [-1.5, 0.5, -0.8],
        [-0.8, 0.7, 0],
      ],
      C.gray,
    ),
  );
  group.add(
    tube(
      [
        [-2.6, 0.22, 1.2],
        [-1.5, 0.5, 0.8],
        [-0.8, 0.7, 0],
      ],
      hold ? C.warm : C.gray,
    ),
  );
  const gate = new T.Group();
  gate.position.set(1.25, 0, 0);
  gate.add(box([0.16, 2, 0.16], C.ink, [0, 1, -0.75]));
  gate.add(box([0.16, 2, 0.16], C.ink, [0, 1, 0.75]));
  gate.add(box([0.16, 0.13, 1.6], C.ink, [0, 2, 0]));
  const door = box(
    [0.075, 1.6, 1.3],
    ready ? C.green : hold ? C.warm : C.gray,
    [0, 1, 0],
    0.6,
  );
  if (ready) door.rotation.y = Math.PI / 2;
  gate.add(door);
  group.add(
    gate,
    arrow([-0.55, 0.7, 0], [0.8, 0.7, 0], hold ? C.warm : C.blue),
  );
  if (ready)
    for (let i = 0; i < 4; i++)
      group.add(
        box([1.7, 0.065, 1.9], i === 3 ? 0xd3e9df : C.white, [
          3.65,
          0.12 + i * 0.08,
          0,
        ]),
      );
  group.add(
    label(
      ready
        ? "Ready for human review"
        : hold
          ? "HOLD · conflicting dates"
          : "Evidence gate",
      [1.2, 2.6, 0],
      0.3,
    ),
  );
  if (ready) {
    group.add(arrow([1.5, 0.7, 0], [2.6, 0.7, 0], C.green));
    group.add(label("Review packet", [3.65, 0.8, 0], 0.25));
  }
  return { group };
}
export const EXHIBIT_IDS = [
  "counterspeech-dynamics",
  "normalized-gain-laplacians",
  "extremal-gain-laplacian-bounds",
  "urban-microregion-logistics",
  "square-root-natural-gradient",
  "experience-replay-optimization",
  "rank-feasibility",
  "ticlm-replay-value",
  "casepath",
  "spatial-intelligence",
];
const exhibitKinds: ScienceKind[] = [
  "network",
  "graph",
  "frustration",
  "urban",
  "gaussian",
  "replay",
  "rank",
  "temporal",
  "evidence",
  "atlas",
];
const shortLabels = [
  "Interaction",
  "Gain graphs",
  "Frustration",
  "Urban context",
  "Geometry",
  "Replay",
  "Rank",
  "Time",
  "Evidence",
  "Worlds",
];
function collection(overview: boolean, reduced = false, lens = "time"): Model {
  const group = new T.Group(),
    models: Model[] = [];
  const ids = overview ? [1, 5, 9] : EXHIBIT_IDS.map((_, i) => i);
  ids.forEach((i, j) => {
    const model =
      i === 9
        ? { group: miniatureWorld() }
        : buildScience({
            kind: exhibitKinds[i],
            step: 4,
            value:
              i === 6
                ? 3
                : i === 4
                  ? 4
                  : i === 7
                    ? 30
                    : i === 3
                      ? 4
                      : i === 5
                        ? 3
                        : 65,
            secondary: i === 5 ? 155 : i === 7 ? 0.8 : 2,
            reduced,
          });
    const orders: Record<string, number[]> = {
      time: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      questions: [0, 1, 2, 3, 8, 4, 5, 6, 7, 9],
      methods: [0, 3, 1, 2, 4, 5, 6, 7, 8, 9],
      systems: [1, 2, 4, 0, 3, 5, 6, 7, 8, 9],
      frontier: [0, 1, 3, 2, 4, 8, 5, 6, 7, 9],
    };
    const slot = (orders[lens] ?? orders.time).indexOf(i);
    const x = overview ? (j - 1) * 5.1 : ((slot % 5) - 2) * 3.05,
      z = overview ? (j === 1 ? -0.65 : 0) : Math.floor(slot / 5) * 4.2 - 2;
    model.group.scale.setScalar(
      overview ? (i === 9 ? 0.52 : i === 1 ? 0.72 : 0.57) : 0.29,
    );
    if (overview)
      model.group.traverse((o) => {
        if (o instanceof T.Sprite) o.visible = false;
      });
    const node = new T.Group();
    node.position.set(x, 0, z);
    node.userData.workId = EXHIBIT_IDS[i];
    node.add(model.group);
    group.add(node);
    models.push(model);
    if (!overview)
      node.add(
        label(
          `${String(i + 1).padStart(2, "0")}  ${shortLabels[i]}`,
          [0, 1.7, 0],
          0.3,
        ),
      );
  });
  if (!overview && lens === "time") {
    const path: V3[] = ids.map((_, j) => [
      ((j % 5) - 2) * 3.05,
      -0.17,
      Math.floor(j / 5) * 4.2 - 2,
    ]);
    group.add(line(path, C.gray, 0.4));
  }
  return {
    group,
    update: (seconds, dt) => {
      let active = false;
      models.forEach((m) => {
        if (m.update?.(seconds, dt)) active = true;
      });
      return active;
    },
  };
}
export function buildScience(s: ScienceState): Model {
  switch (s.kind) {
    case "graph":
    case "frustration":
      return graphModel(s);
    case "replay":
      return replayModel(s);
    case "rank":
      return rankModel(s);
    case "temporal":
      return temporalModel(s);
    case "gaussian":
      return gaussianModel(s);
    case "urban":
      return urbanModel(s);
    case "network":
      return networkModel(s);
    case "evidence":
      return evidenceModel(s);
    case "trajectory":
      return collection(false, s.reduced, s.comparison);
    default:
      return collection(true, s.reduced);
  }
}
