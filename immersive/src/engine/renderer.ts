import * as T from "three";
import { advanceFrameClock } from "./clock";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildScience, type ScienceState } from "./scientificModels";
import { buildWorld } from "./worldModels";
import { disposeObject, material, type Model } from "./primitives";
import type { WorldState } from "./world";
import type { V3 } from "./science";
export type SceneConfig = Omit<ScienceState, "kind"> & {
  kind: ScienceState["kind"] | "world";
  world?: WorldState;
  runAgent?: boolean;
  interaction?: "orbit" | "move";
};
export type SceneCallbacks = {
  onPick?: (id: string) => void;
  onMove?: (id: string, p: V3) => void;
  onAgentDone?: () => void;
  onError?: (message: string) => void;
};
export class ResearchRenderer {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly ready: Promise<void>;
  private prepared = false;
  readonly camera = new T.PerspectiveCamera(38, 1, 0.1, 160);
  readonly controls: OrbitControls;
  private model: Model | null = null;
  private config: SceneConfig;
  private callbacks: SceneCallbacks;
  private lastAspect = 0;
  private layoutMoves: {
    object: T.Object3D;
    from: T.Vector3;
    to: T.Vector3;
  }[] = [];
  private layoutTime = 1;
  private backdrop: T.Texture | null = null;
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private paused = false;
  private raf = 0;
  private disposed = false;
  private visible = true;
  private elapsed = 0;
  private last = 0;
  private frames = 0;
  private keyLight = new T.DirectionalLight(0xfffaf2, 3.2);
  private fillLight = new T.HemisphereLight(0xcfe3ff, 0xf5efe6, 1.65);
  private raycaster = new T.Raycaster();
  private pointer = new T.Vector2();
  private down: T.Vector2 | null = null;
  private dragging: T.Object3D | null = null;
  private dragPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  private tween: {
    from: T.Vector3;
    to: T.Vector3;
    targetFrom: T.Vector3;
    targetTo: T.Vector3;
    elapsed: number;
  } | null = null;
  constructor(
    private host: HTMLElement,
    config: SceneConfig,
    callbacks: SceneCallbacks,
  ) {
    this.config = config;
    this.callbacks = callbacks;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Interactive 3D scene. Drag to orbit. Use the camera buttons for keyboard navigation.",
    );
    canvas.dataset.renderer = "webgl2";
    this.host.appendChild(canvas);
    this.scene.background = new T.Color(0xf4f7fa);
    this.scene.fog = new T.Fog(0xf4f7fa, 32, 75);
    this.keyLight.position.set(4, 12, 7);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.keyLight.shadow.camera, {
      left: -17,
      right: 17,
      top: 17,
      bottom: -17,
      near: 0.5,
      far: 60,
    });
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.05;
    this.scene.add(this.keyLight, this.fillLight);
    const rim = new T.DirectionalLight(0xd6e6ff, 0.75);
    rim.position.set(-8, 6, -6);
    this.scene.add(rim);
    const floor = new T.Mesh(new T.PlaneGeometry(200, 200), material(0xf4f7fa));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.42;
    floor.receiveShadow = true;
    floor.name = "ground";
    this.scene.add(floor);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 38;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.addEventListener("change", this.invalidate);
    canvas.addEventListener("pointerdown", this.pointerDown, true);
    canvas.addEventListener("pointermove", this.pointerMove, true);
    canvas.addEventListener("pointerup", this.pointerUp, true);
    canvas.addEventListener("pointercancel", this.pointerUp, true);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    document.addEventListener("visibilitychange", this.visibilityChanged);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible) {
          this.last = 0;
          this.invalidate();
        } else if (this.raf) {
          cancelAnimationFrame(this.raf);
          this.raf = 0;
        }
      },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(host);
    this.update(config, callbacks);
    this.resize();
    this.setView("overview", true);
    this.ready = this.renderer
      .compileAsync(this.scene, this.camera)
      .then(() => {
        if (this.disposed) return;
        this.prepared = true;
        this.frame(performance.now());
      });
  }
  private resize = () => {
    if (this.disposed) return;
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    if (
      this.lastAspect &&
      Math.abs(this.lastAspect - this.camera.aspect) > 0.15
    )
      this.setView("overview", true);
    this.lastAspect = this.camera.aspect;
    this.invalidate();
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    if (!this.disposed)
      this.callbacks.onError?.(
        "The graphics context was lost. The accessible explanation remains available. Reload to restore 3D.",
      );
  };
  private visibilityChanged = () => {
    if (!document.hidden) {
      this.last = 0;
      this.invalidate();
    } else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };
  update(config: SceneConfig, callbacks = this.callbacks) {
    const previous = this.config;
    const changed = previous.kind !== config.kind,
      oldSelection = previous.selected;
    const oldPositions = new Map<string, T.Vector3>();
    this.model?.group.children.forEach((o) => {
      if (o.userData.workId)
        oldPositions.set(o.userData.workId, o.position.clone());
    });
    const continuous =
      config.kind === "world" &&
      this.config.kind === "world" &&
      config.world?.revision === this.config.world?.revision &&
      config.step === this.config.step &&
      config.runAgent === this.config.runAgent;
    this.config = config;
    this.callbacks = callbacks;
    if (!continuous) this.elapsed = 0;
    if (this.model) {
      this.scene.remove(this.model.group);
      disposeObject(this.model.group);
    }
    if (config.kind === "world" && config.world) {
      this.model = buildWorld(
        config.world,
        config.selected,
        config.runAgent,
        callbacks.onAgentDone,
        false,
        config.reduced,
        previous.world,
      );
    } else this.model = buildScience(config as ScienceState);
    this.scene.add(this.model.group);
    this.layoutMoves = [];
    this.layoutTime = 1;
    if (
      config.kind === "trajectory" &&
      previous.comparison !== config.comparison &&
      !config.reduced
    ) {
      this.model.group.children.forEach((object) => {
        const from = oldPositions.get(object.userData.workId);
        if (from) {
          this.layoutMoves.push({ object, from, to: object.position.clone() });
          object.position.copy(from);
        }
      });
      this.layoutTime = 0;
    }
    this.renderer.domElement.dataset.layout = JSON.stringify(
      this.model.group.children
        .filter((o) => o.userData.workId)
        .map((o) => ({
          id: o.userData.workId,
          position: (
            this.layoutMoves.find((m) => m.object === o)?.to ?? o.position
          ).toArray(),
        })),
    );

    const night = config.kind === "world" && config.world?.time === "night";
    const sunset = config.kind === "world" && config.world?.time === "sunset";
    const bg = night ? 0x12253c : sunset ? 0xeedecb : 0xe7f0f8;
    this.backdrop?.dispose();
    this.backdrop = null;
    if (config.kind === "world") {
      const sky = document.createElement("canvas");
      sky.width = 8;
      sky.height = 256;
      const ctx = sky.getContext("2d")!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(
        0,
        night ? "#071322" : sunset ? "#849caf" : "#a6c7e1",
      );
      gradient.addColorStop(
        0.7,
        night ? "#20384e" : sunset ? "#f2d8b5" : "#e8f2f8",
      );
      gradient.addColorStop(
        1,
        night ? "#304154" : sunset ? "#f4e9dd" : "#f4f7fa",
      );
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 8, 256);
      this.backdrop = new T.CanvasTexture(sky);
      this.backdrop.colorSpace = T.SRGBColorSpace;
      this.scene.background = this.backdrop;
      this.scene.fog = new T.Fog(bg, 34, 75);
    } else {
      this.scene.background = new T.Color(0xf4f7fa);
      this.scene.fog = new T.Fog(0xf4f7fa, 32, 75);
    }

    this.keyLight.color.set(night ? 0xa6c2ed : sunset ? 0xffd5ae : 0xfffaf2);
    this.keyLight.intensity = night ? 0.45 : sunset ? 3.0 : 3.2;
    this.fillLight.intensity = night ? 0.65 : 1.65;
    if (changed || previous.comparison !== config.comparison)
      this.setView("overview", true);
    if (
      config.kind === "trajectory" &&
      config.selected &&
      config.selected !== oldSelection
    )
      this.setView("selected");
    this.renderer.domElement.dataset.kind = config.kind;
    this.renderer.domElement.dataset.sceneObjects = String(
      config.world?.objects.length ?? 0,
    );
    this.invalidate();
  }
  setView(view: string, instant = false) {
    const kind = this.config.kind;
    let target = new T.Vector3(0, 0.8, 0);
    let end = new T.Vector3(8.5, 7.5, 10);
    if (kind === "atlas") {
      end.set(6.4, 6.6, 12.5);
      target.set(0, 0.4, 0);
    }
    if (kind === "trajectory") {
      end.set(0, 13.5, 17.5);
      target.set(0, 0.35, 0);
    }
    if (kind === "world") {
      end.set(9.5, 7, 11.5);
      target.set(0, 1, 0);
    }
    if (kind === "rank") {
      end.set(10, 9, 13);
      target.set(0, 1, 2);
    }
    if (kind === "replay") {
      end.set(8.3, 8.2, 11);
      target.set(0, 1.4, 0);
    }
    if (view === "inside") {
      end.set(0, 1.8, 3.6);
      target.set(0, 1.35, -1.5);
    }
    if (view === "top") {
      end.set(0.05, 17, 0.2);
      target.set(0, 0, 0);
    }
    if (view === "selected" && this.model) {
      this.model.group.children.forEach((o) => {
        if (o.userData.workId === this.config.selected) {
          target = o.position.clone();
          end = target.clone().add(new T.Vector3(3.8, 4.2, 5));
        }
      });
    }
    if (
      view === "overview" &&
      this.model &&
      ["atlas", "trajectory", "rank"].includes(kind)
    ) {
      const bounds = new T.Box3().setFromObject(this.model.group),
        center = bounds.getCenter(new T.Vector3());
      const back = end.clone().sub(target).normalize(),
        right = new T.Vector3(0, 1, 0).cross(back).normalize(),
        up = back.clone().cross(right).normalize();
      const tanV = Math.tan((this.camera.fov * Math.PI) / 360) * 0.94,
        tanH = tanV * this.camera.aspect;
      let distance = 0;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const p = new T.Vector3(x, y, z).sub(center);
            distance = Math.max(
              distance,
              p.dot(back) + Math.abs(p.dot(right)) / tanH,
              p.dot(back) + Math.abs(p.dot(up)) / tanV,
            );
          }
      target.copy(center);
      end.copy(center).addScaledVector(back, distance);
    } else if (this.camera.aspect < 1.25 && view === "overview")
      end
        .sub(target)
        .multiplyScalar(Math.min(1.7, 1.4 / this.camera.aspect))
        .add(target);
    if (view === "left" || view === "right") {
      target = this.controls.target.clone();
      end = this.camera.position.clone().sub(target);
      end
        .applyAxisAngle(new T.Vector3(0, 1, 0), view === "left" ? 0.32 : -0.32)
        .add(target);
    }
    if (view === "closer" || view === "farther") {
      target = this.controls.target.clone();
      end = this.camera.position
        .clone()
        .sub(target)
        .multiplyScalar(view === "closer" ? 0.83 : 1.2)
        .clampLength(3, 38)
        .add(target);
    }
    if (instant || this.config.reduced) {
      this.camera.position.copy(end);
      this.controls.target.copy(target);
      this.controls.update();
      this.tween = null;
    } else
      this.tween = {
        from: this.camera.position.clone(),
        to: end,
        targetFrom: this.controls.target.clone(),
        targetTo: target,
        elapsed: 0,
      };
    this.invalidate();
  }
  private pick(event: PointerEvent) {
    if (!this.model) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObject(this.model.group, true)) {
      let object: T.Object3D | null = hit.object;
      while (object && object !== this.model.group) {
        if (object.userData.objectId || object.userData.workId) return object;
        object = object.parent;
      }
    }
    return null;
  }
  private pointerDown = (event: PointerEvent) => {
    this.tween = null;
    this.down = new T.Vector2(event.clientX, event.clientY);
    if (this.config.interaction === "move") {
      const object = this.pick(event);
      if (object?.userData.objectId) {
        this.dragging = object;
        this.dragPlane.constant = -object.position.y;
        this.controls.enabled = false;
        this.renderer.domElement.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    }
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.dragging) return;
    this.pick(event);
    const hit = new T.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, hit)) {
      this.dragging.position.set(
        T.MathUtils.clamp(hit.x, -4.5, 4.5),
        this.dragging.position.y,
        T.MathUtils.clamp(hit.z, -3.5, 3.5),
      );
      this.invalidate();
    }
  };
  private pointerUp = (event: PointerEvent) => {
    if (this.dragging) {
      const object = this.dragging;
      this.dragging = null;
      this.controls.enabled = true;
      this.callbacks.onMove?.(
        String(object.userData.objectId),
        object.position.toArray() as V3,
      );
    } else if (
      this.down &&
      this.down.distanceTo(new T.Vector2(event.clientX, event.clientY)) < 5
    ) {
      const object = this.pick(event);
      if (object)
        this.callbacks.onPick?.(
          String(object.userData.objectId ?? object.userData.workId),
        );
    }
    this.down = null;
  };
  invalidate = () => {
    if (
      this.prepared &&
      !this.disposed &&
      this.visible &&
      !document.hidden &&
      !this.raf
    )
      this.raf = requestAnimationFrame(this.frame);
  };
  private frame = (now: number) => {
    this.raf = 0;
    if (!this.prepared || this.disposed || !this.visible || document.hidden)
      return;
    const clock = advanceFrameClock(now, this.last);
    const dt = clock.delta;
    this.last = clock.timestamp;
    if (!this.paused) this.elapsed += dt;
    let active =
      this.paused || this.dragging
        ? false
        : (this.model?.update?.(this.elapsed, dt) ?? false);
    if (this.tween) {
      this.tween.elapsed += dt;
      const t = Math.min(1, this.tween.elapsed / 0.75),
        e = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
      this.controls.target.lerpVectors(
        this.tween.targetFrom,
        this.tween.targetTo,
        e,
      );
      active = true;
      if (t === 1) this.tween = null;
    }
    if (this.layoutTime < 1) {
      this.layoutTime = Math.min(1, this.layoutTime + dt / 0.7);
      const e = this.layoutTime * this.layoutTime * (3 - 2 * this.layoutTime);
      this.layoutMoves.forEach((m) =>
        m.object.position.lerpVectors(m.from, m.to, e),
      );
      active = true;
    }
    const changing = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    const canvas = this.renderer.domElement;
    canvas.dataset.frames = String(this.frames);
    canvas.dataset.paused = String(this.paused);
    canvas.dataset.elapsed = String(this.elapsed);
    const agent = this.model?.group.getObjectByName("demonstration-agent");
    canvas.dataset.agentPosition = agent
      ? agent.position.toArray().join(",")
      : "";
    canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    canvas.dataset.camera = this.camera.position
      .toArray()
      .map((v) => v.toFixed(5))
      .join(",");
    canvas.dataset.target = this.controls.target
      .toArray()
      .map((v) => v.toFixed(5))
      .join(",");
    canvas.dataset.fov = String(this.camera.fov);
    if (active || changing) this.invalidate();
  };
  setPaused(value: boolean) {
    this.paused = value;
    this.invalidate();
  }
  getStats() {
    return {
      frames: this.frames,
      triangles: this.renderer.info.render.triangles,
      drawCalls: this.renderer.info.render.calls,
      version: this.renderer
        .getContext()
        .getParameter(this.renderer.getContext().VERSION),
    };
  }
  dispose() {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    const c = this.renderer.domElement;
    c.removeEventListener("pointerdown", this.pointerDown, true);
    c.removeEventListener("pointermove", this.pointerMove, true);
    c.removeEventListener("pointerup", this.pointerUp, true);
    c.removeEventListener("pointercancel", this.pointerUp, true);
    c.removeEventListener("webglcontextlost", this.contextLost);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.dispose();
    this.backdrop?.dispose();
    disposeObject(this.scene);
    this.keyLight.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    c.remove();
  }
}
