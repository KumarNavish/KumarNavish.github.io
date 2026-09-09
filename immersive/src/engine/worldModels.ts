import * as T from "three";
import {
  box,
  cylinder,
  rod,
  sphere,
  mesh,
  C,
  ring,
  line,
  type Model,
} from "./primitives";
import {
  agentPath,
  initialWorld,
  type WorldObject,
  type WorldState,
} from "./world";
import type { V3 } from "./science";
export function pine(scale = 1) {
  const g = new T.Group();
  g.add(cylinder(0.07, 0.9, 0x766452, [0, 0.45, 0]));
  for (let i = 0; i < 3; i++)
    g.add(
      mesh(
        new T.ConeGeometry(0.57 - i * 0.1, 1.1, 8),
        i === 2 ? 0x6d8b83 : 0x537369,
        [0, 0.85 + i * 0.38, 0],
      ),
    );
  g.scale.setScalar(scale);
  return g;
}
export function makeObject(o: WorldObject) {
  const g = new T.Group();
  g.name = o.name;
  g.userData.objectId = o.id;
  if (o.kind === "bench") {
    g.add(
      box([5, 0.14, 1.7], 0xe2e7e9, [0, 1.05, 0]),
      box([5.04, 0.035, 1.73], C.white, [0, 1.14, 0]),
    );
    for (const x of [-2.22, 2.22])
      for (const z of [-0.62, 0.62])
        g.add(box([0.12, 1.02, 0.12], 0x85959f, [x, 0.51, z]));
    g.add(rod([-2.2, 0.2, -0.62], [2.2, 0.2, -0.62], 0.045, 0x85959f));
  } else if (o.kind === "microscope") {
    g.add(
      box([0.54, 0.075, 0.4], C.ink, [0, 0.04, 0]),
      box([0.4, 0.09, 0.28], C.white, [0, 0.11, 0]),
    );
    g.add(
      rod([-0.15, 0.13, 0.03], [-0.15, 0.65, -0.1], 0.075, 0xd7e0e5),
      box([0.36, 0.035, 0.31], C.ink, [0.07, 0.39, 0.02]),
    );
    const head = new T.Group();
    head.position.set(-0.12, 0.67, -0.07);
    head.rotation.z = -0.28;
    head.add(
      cylinder(0.085, 0.38, C.white, [0, 0.06, 0]),
      cylinder(0.06, 0.1, C.ink, [0, 0.29, 0]),
      cylinder(0.05, 0.11, C.ink, [0, -0.18, 0]),
    );
    g.add(head);
    g.add(
      sphere(0.065, C.blue, [-0.22, 0.4, 0.04]),
      cylinder(0.055, 0.035, C.cyan, [0.05, 0.423, 0.02]),
    );
  } else if (o.kind === "robot") {
    g.add(
      cylinder(0.23, 0.13, 0x526573, [0, 0.065, 0]),
      cylinder(0.14, 0.19, C.white, [0, 0.2, 0]),
    );
    const elbow: V3 = [0.14, 0.74, 0],
      wrist: V3 = [-0.4, 1.04, 0.08];
    g.add(
      rod([0, 0.25, 0], elbow, 0.105, C.white),
      sphere(0.125, C.ink, elbow),
      rod(elbow, wrist, 0.085, C.white),
      sphere(0.09, C.ink, wrist),
    );
    g.add(
      rod(wrist, [-0.55, 0.85, 0.1], 0.052, C.white),
      rod([-0.55, 0.85, 0.1], [-0.55, 0.72, 0.1], 0.038, C.warm),
      rod([-0.62, 0.72, 0.1], [-0.48, 0.72, 0.1], 0.018, C.ink),
    );
    g.add(
      rod([-0.62, 0.72, 0.1], [-0.64, 0.63, 0.1], 0.014, C.ink),
      rod([-0.48, 0.72, 0.1], [-0.46, 0.63, 0.1], 0.014, C.ink),
    );
  } else if (o.kind === "sample") {
    g.add(
      cylinder(0.17, 0.036, 0xacc7d5, [0, 0.025, 0]),
      cylinder(0.13, 0.022, 0xc1ded4, [0, 0.053, 0]),
    );
    for (let i = 0; i < 5; i++)
      g.add(
        sphere(0.022, i % 2 ? C.blue : C.warm, [
          Math.cos(i * 2.4) * 0.07,
          0.067,
          Math.sin(i * 2.4) * 0.07,
        ]),
      );
  } else if (o.kind === "window") {
    g.add(
      box([5.8, 0.07, 0.08], 0x52616c, [0, 1.15, 0]),
      box([5.8, 0.07, 0.08], 0x52616c, [0, 2.4, 0]),
    );
    for (const x of [-2.88, 0, 2.88])
      g.add(box([0.07, 1.3, 0.08], 0x52616c, [x, 1.77, 0]));
    g.add(box([5.7, 1.2, 0.035], 0xaacbdc, [0, 1.78, 0], 0.24));
  } else if (o.kind === "lamp") {
    g.add(
      cylinder(0.15, 0.04, C.ink, [0, 0.03, 0]),
      rod([0, 0.05, 0], [0, 0.66, 0], 0.025, C.ink),
      rod([0, 0.64, 0], [-0.25, 0.74, 0], 0.022, C.ink),
    );
    const shade = mesh(
      new T.ConeGeometry(0.19, 0.17, 24, 1, true),
      C.white,
      [-0.25, 0.71, 0],
    );
    g.add(shade, cylinder(0.16, 0.01, 0xffe5ae, [-0.25, 0.626, 0]));
  } else if (o.kind === "tree") g.add(pine(1.05));
  else if (o.kind === "cabinet") {
    g.add(box([0.86, 1.45, 0.58], 0xe6ebeb, [0, 0.725, 0]));
    for (let i = 0; i < 3; i++) {
      g.add(
        box([0.79, 0.38, 0.035], C.white, [0, 0.31 + i * 0.44, 0.31]),
        box([0.2, 0.025, 0.06], 0x73838a, [0, 0.35 + i * 0.44, 0.34]),
      );
    }
  }
  g.position.set(...o.position);
  g.rotation.y = (o.rotation * Math.PI) / 180;
  return g;
}
export function explorerRobot() {
  const g = new T.Group();
  g.add(
    box([0.38, 0.26, 0.43], C.white, [0, 0.23, 0]),
    box([0.31, 0.095, 0.025], C.ink, [0, 0.3, 0.23]),
  );
  for (const x of [-0.21, 0.21])
    for (const z of [-0.14, 0.14]) {
      const w = cylinder(0.075, 0.045, C.ink, [x, 0.13, z]);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
  g.add(
    sphere(0.027, C.blue, [-0.07, 0.3, 0.25]),
    sphere(0.027, C.blue, [0.07, 0.3, 0.25]),
    rod([0, 0.35, 0], [0, 0.55, 0], 0.012, C.ink),
    sphere(0.035, C.warm, [0, 0.57, 0]),
  );
  return g;
}
function terrain() {
  const geo = new T.PlaneGeometry(36, 28, 100, 80);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position,
    colors: number[] = [];
  const peaks = [
    [-9, -9, 8.2, 3.4],
    [-3, -11, 10, 3.1],
    [4, -10, 7.8, 2.8],
    [11, -9, 10, 4],
    [-12, -1, 5, 3.2],
    [12, -1, 4, 3.2],
  ];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    let h = -0.55;
    for (const [cx, cz, high, sigma] of peaks)
      h += high * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (sigma * sigma));
    h +=
      (Math.sin(x * 2.6) * Math.cos(z * 2.4) * 0.26 +
        Math.sin(x * 0.7 + z * 2) * 0.32) *
      Math.min(1, Math.max(0, Math.hypot(x, z) - 4));
    h *= Math.min(1, Math.max(0, (Math.hypot(x, z * 0.85) - 4.6) / 2));
    p.setY(i, h - 0.24);
    const c = new T.Color(
      h > 6.2 ? 0xf4f5f4 : h > 3.6 ? 0xa9b6c4 : h > 1.1 ? 0x788994 : 0xa4b3ad,
    );
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.94,
    }),
  );
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}
export function buildWorld(
  world: WorldState,
  selected = "",
  runAgent = false,
  onDone?: () => void,
  mini = false,
  reduced = false,
  previous?: WorldState,
): Model {
  const group = new T.Group();
  if (!mini && world.environment === "mountain") group.add(terrain());
  else if (!mini) {
    const floor = box([30, 0.2, 25], 0xc5d1c7, [0, -0.35, -3]);
    group.add(floor);
    if (world.environment === "forest")
      for (let i = 0; i < 20; i++) {
        const tree = pine(0.9 + (i % 4) * 0.25),
          angle = i * 2.4;
        tree.position.set(
          Math.cos(angle) * (7 + (i % 5)),
          0,
          Math.sin(angle) * (7 + (i % 4)),
        );
        group.add(tree);
      }
  }
  group.add(
    box([8, 0.24, 5.7], 0xe6e9e8, [0, -0.13, 0]),
    box([7.7, 0.04, 5.4], 0xf6f4ee, [0, 0.01, 0]),
  );
  for (let i = 0; i < 12; i++)
    group.add(box([0.012, 0.008, 5.2], 0xd6d7d2, [-3.7 + i * 0.64, 0.036, 0]));
  group.add(box([6.3, 0.48, 0.15], 0xc4cbd0, [0, 0.24, -2.2]));
  for (const x of [-3.1, 3.1])
    for (const z of [-2.2, 2.2])
      group.add(box([0.1, 2.8, 0.1], C.white, [x, 1.4, z]));
  group.add(box([6.4, 0.16, 1.5], 0xf5f4ef, [0, 2.8, -1.5]));
  for (const x of [-3.1, 3.1])
    group.add(rod([x, 2.7, -2.2], [x, 2.7, 2.2], 0.055, 0x87949c));
  group.add(rod([-3.1, 2.7, 2.2], [3.1, 2.7, 2.2], 0.05, 0x87949c));
  for (let i = 0; i < 4; i++)
    group.add(box([1.1, 0.09, 0.5], 0xd6d9d7, [-2.7, 0.05, 3.2 + i * 0.68]));
  if (!mini)
    for (const [x, z, s] of [
      [-4.8, -3.5, 1.3],
      [4.8, -4, 1.2],
      [5.2, 2, 0.85],
      [-5.4, 1.2, 0.9],
    ]) {
      const p = pine(s);
      p.position.set(x, -0.1, z);
      group.add(p);
    }
  const objects = world.objects.map(makeObject);
  objects.forEach((o) => group.add(o));
  const transitions = objects.map((object) => {
    const before = previous?.objects.find(
      (o) => o.id === object.userData.objectId,
    );
    return {
      object,
      start: before
        ? new T.Vector3(...before.position)
        : object.position.clone(),
      end: object.position.clone(),
      added: Boolean(previous && !before),
      rotation: before ? (before.rotation * Math.PI) / 180 : object.rotation.y,
      endRotation: object.rotation.y,
    };
  });

  const selectedObject = world.objects.find((o) => o.id === selected);
  if (selectedObject)
    group.add(
      ring(0.48, C.blue, [
        selectedObject.position[0],
        selectedObject.position[1] + 0.03,
        selectedObject.position[2],
      ]),
    );
  const robot = explorerRobot();
  robot.name = "demonstration-agent";
  robot.position.set(...(world.agentPosition ?? [-2.9, 0, 1.75]));
  robot.rotation.y = world.agentHeading ?? 0;
  group.add(robot);
  const route = world.goal ? agentPath(world, world.goal.targetId) : [];
  let finished = false,
    transitionFinished = false;
  if (route.length && runAgent)
    group.add(
      line(
        route.map((p) => [p[0], 0.055, p[2]]),
        C.blue,
        0.65,
      ),
    );
  const lamp = new T.PointLight(
    world.time === "night" ? 0xb6d7ff : 0xffe3b3,
    world.time === "night" ? 14 : 2,
    8,
    2,
  );
  lamp.position.set(0, 2.45, -0.4);
  group.add(lamp);
  if (world.time === "night") {
    const glow = box([5.6, 0.018, 0.6], 0xffdda5, [0, 2.7, -1.5]);
    (glow.material as T.MeshStandardMaterial).emissive.set(0xffc77d);
    (glow.material as T.MeshStandardMaterial).emissiveIntensity = 0.8;
    group.add(glow);
  }
  return {
    group,
    update: (seconds) => {
      const t = reduced ? 1 : Math.min(1, seconds / 0.85),
        ease = 1 - Math.pow(1 - t, 3);
      let moving =
        t < 1 && Boolean(previous && previous.revision !== world.revision);
      if (!transitionFinished) {
        for (const m of transitions) {
          m.object.position.lerpVectors(m.start, m.end, ease);
          m.object.rotation.y =
            m.rotation + (m.endRotation - m.rotation) * ease;
          if (m.added) m.object.scale.setScalar(Math.max(0.001, ease));
        }
        if (t === 1) transitionFinished = true;
      }
      if (!runAgent || !route.length || finished) return moving;
      const index = Math.min(
          route.length - 1,
          Math.floor((reduced ? 10000 : Math.max(0, seconds - 0.85)) * 8),
        ),
        p = route[index];
      robot.position.set(p[0], 0, p[2]);
      if (index < route.length - 1) {
        const n = route[index + 1];
        robot.rotation.y = Math.atan2(n[0] - p[0], n[2] - p[2]);
      }
      if (index === route.length - 1) {
        finished = true;
        onDone?.();
        return false;
      }
      return true;
    },
  };
}
export function miniatureWorld() {
  const w = initialWorld();
  return buildWorld(w, "", false, undefined, true).group;
}
