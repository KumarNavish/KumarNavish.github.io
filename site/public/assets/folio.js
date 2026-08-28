(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const folioScriptUrl = document.currentScript?.src || '';
  const staticPreview = new URLSearchParams(window.location.search).has('static');
  const body = document.body;

  /* -------------------------------------------------------------------------- */
  /* Reading scale                                                              */
  /* -------------------------------------------------------------------------- */

  const scaleValues = new Set(['signal', 'evidence', 'detail']);

  function setReadingScale(value) {
    const resolved = scaleValues.has(value) ? value : 'evidence';
    body.dataset.scale = resolved;
    $$('[data-scale-value]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.scaleValue === resolved));
    });
    try {
      localStorage.setItem('navish-folio-scale', resolved);
    } catch (_) {
      // Storage is an enhancement, never a dependency.
    }
  }

  $$('[data-scale-value]').forEach((button) => {
    button.addEventListener('click', () => setReadingScale(button.dataset.scaleValue));
  });

  try {
    setReadingScale(localStorage.getItem('navish-folio-scale') || 'evidence');
  } catch (_) {
    setReadingScale('evidence');
  }

  /* -------------------------------------------------------------------------- */
  /* KaTeX progressive enhancement                                               */
  /* -------------------------------------------------------------------------- */

  function renderMath() {
    if (!window.katex) return;
    $$('[data-tex]').forEach((element) => {
      if (element.dataset.mathRendered === 'true') return;
      try {
        window.katex.render(element.dataset.tex || element.textContent || '', element, {
          throwOnError: false,
          strict: false,
          output: 'mathml',
          displayMode: element.classList.contains('equation'),
        });
        element.dataset.mathRendered = 'true';
      } catch (_) {
        // Keep the readable textual fallback already present in the document.
      }
    });
  }

  async function loadMathRenderer() {
    if (window.katex) {
      renderMath();
      return;
    }
    if (!folioScriptUrl) return;
    try {
      const moduleUrl = new URL('./vendor/katex.mjs', folioScriptUrl).href;
      const module = await import(moduleUrl);
      window.katex = module.default || module;
      renderMath();
    } catch (_) {
      // The human-readable mathematical fallback remains visible.
    }
  }

  renderMath();
  loadMathRenderer();
  window.addEventListener('load', renderMath, { once: true });
  window.setTimeout(renderMath, 1200);

  /* -------------------------------------------------------------------------- */
  /* Deterministic helpers                                                       */
  /* -------------------------------------------------------------------------- */

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function random() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function colorWithAlpha(hex, alpha) {
    const value = hex.replace('#', '');
    const normalized = value.length === 3
      ? value.split('').map((char) => char + char).join('')
      : value;
    const number = Number.parseInt(normalized, 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  /* -------------------------------------------------------------------------- */
  /* Interactive architectural maquette                                         */
  /* -------------------------------------------------------------------------- */

  class ResearchMaquette {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d', { alpha: true });
      this.width = 0;
      this.height = 0;
      this.pixelRatio = 1;
      this.yaw = -0.45;
      this.pitch = 0.28;
      this.roll = -0.04;
      this.panX = 0;
      this.panY = 0;
      this.cameraDistance = 7.2;
      this.velocity = { yaw: 0, pitch: 0, roll: 0, panX: 0, panY: 0 };
      this.drag = null;
      this.hovered = null;
      this.selected = 'frontier';
      this.projectedAnchors = [];
      this.isVisible = true;
      this.lastTime = performance.now();
      this.clusters = this.buildClusters();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      this.installEvents();
      this.observeVisibility();
      this.resize();
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    buildClusters() {
      const definitions = [
        { id: 'replay', label: 'REPLAY / M.01', target: '#replay', anchor: [-1.85, 0.85, 0.15], size: [1.35, 1.05, 0.95], color: '#e44b32', seed: 11 },
        { id: 'rank', label: 'RANK / M.02', target: '#rank', anchor: [1.65, 1.0, -0.35], size: [1.15, 1.45, 0.8], color: '#315bff', seed: 23 },
        { id: 'casepath', label: 'AGENTS / M.03', target: '#casepath', anchor: [1.75, -1.15, 0.55], size: [1.45, 0.85, 1.1], color: '#171715', seed: 37 },
        { id: 'ticlm', label: 'TIME / M.04', target: '#ticlm', anchor: [-1.45, -1.35, -0.75], size: [1.6, 0.8, 0.72], color: '#9f563f', seed: 49 },
        { id: 'frontier', label: 'SPACE / F.01', target: '#frontier', anchor: [0.0, 0.0, 0.05], size: [1.1, 1.1, 1.1], color: '#315bff', seed: 71 },
      ];

      return definitions.map((definition) => {
        const random = mulberry32(definition.seed);
        const splats = [];
        const count = definition.id === 'frontier' ? 54 : 34;
        for (let index = 0; index < count; index += 1) {
          const radius = 0.62 + random() * 1.05;
          const theta = random() * Math.PI * 2;
          const phi = Math.acos(2 * random() - 1);
          splats.push({
            position: [
              definition.anchor[0] + Math.sin(phi) * Math.cos(theta) * radius * definition.size[0] * 0.72,
              definition.anchor[1] + Math.cos(phi) * radius * definition.size[1] * 0.72,
              definition.anchor[2] + Math.sin(phi) * Math.sin(theta) * radius * definition.size[2] * 0.72,
            ],
            radius: 0.035 + random() * 0.105,
            stretch: 0.65 + random() * 1.7,
            angle: random() * Math.PI,
            opacity: 0.08 + random() * 0.18,
          });
        }
        return { ...definition, splats };
      });
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = bounds.width;
      this.height = bounds.height;
      this.canvas.width = Math.round(bounds.width * this.pixelRatio);
      this.canvas.height = Math.round(bounds.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    }

    observeVisibility() {
      if (!('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver((entries) => {
        this.isVisible = entries[0]?.isIntersecting ?? true;
      }, { rootMargin: '100px' });
      observer.observe(this.canvas);
    }

    installEvents() {
      this.canvas.tabIndex = 0;

      this.canvas.addEventListener('pointerdown', (event) => {
        this.canvas.setPointerCapture(event.pointerId);
        this.drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          previousX: event.clientX,
          previousY: event.clientY,
          mode: event.shiftKey ? 'pan' : event.altKey ? 'roll' : 'orbit',
          distance: 0,
        };
        this.velocity = { yaw: 0, pitch: 0, roll: 0, panX: 0, panY: 0 };
        this.setStatus(this.drag.mode === 'orbit' ? 'Manual orbit' : this.drag.mode === 'pan' ? 'Plan translation' : 'Axial roll');
      });

      this.canvas.addEventListener('pointermove', (event) => {
        const bounds = this.canvas.getBoundingClientRect();
        const localX = event.clientX - bounds.left;
        const localY = event.clientY - bounds.top;

        if (!this.drag) {
          this.updateHover(localX, localY);
          return;
        }

        const deltaX = event.clientX - this.drag.previousX;
        const deltaY = event.clientY - this.drag.previousY;
        this.drag.previousX = event.clientX;
        this.drag.previousY = event.clientY;
        this.drag.distance += Math.hypot(deltaX, deltaY);

        if (this.drag.mode === 'pan') {
          this.panX += deltaX;
          this.panY += deltaY;
          this.velocity.panX = deltaX * 0.12;
          this.velocity.panY = deltaY * 0.12;
        } else if (this.drag.mode === 'roll') {
          this.roll += deltaX * 0.007;
          this.velocity.roll = deltaX * 0.0008;
        } else {
          this.yaw += deltaX * 0.0065;
          this.pitch = clamp(this.pitch + deltaY * 0.0055, -1.25, 1.25);
          this.velocity.yaw = deltaX * 0.00075;
          this.velocity.pitch = deltaY * 0.00065;
        }
      });

      const endPointer = (event) => {
        if (!this.drag || this.drag.pointerId !== event.pointerId) return;
        const bounds = this.canvas.getBoundingClientRect();
        if (this.drag.distance < 7) {
          this.activateNearest(event.clientX - bounds.left, event.clientY - bounds.top);
        }
        this.drag = null;
        this.setStatus(this.selected ? `Selected / ${this.selected.toUpperCase()}` : 'Ambient orbit');
      };

      this.canvas.addEventListener('pointerup', endPointer);
      this.canvas.addEventListener('pointercancel', endPointer);

      this.canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        this.cameraDistance = clamp(this.cameraDistance + event.deltaY * 0.006, 4.4, 11.5);
        this.setStatus(`Depth / ${this.cameraDistance.toFixed(1)} m`);
        window.clearTimeout(this.wheelStatusTimer);
        this.wheelStatusTimer = window.setTimeout(() => this.setStatus('Ambient orbit'), 700);
      }, { passive: false });

      this.canvas.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 22 : 8;
        if (event.key === 'ArrowLeft') this.yaw -= 0.08;
        if (event.key === 'ArrowRight') this.yaw += 0.08;
        if (event.key === 'ArrowUp') this.pitch -= 0.08;
        if (event.key === 'ArrowDown') this.pitch += 0.08;
        if (event.key === '+' || event.key === '=') this.cameraDistance = clamp(this.cameraDistance - 0.3, 4.4, 11.5);
        if (event.key === '-') this.cameraDistance = clamp(this.cameraDistance + 0.3, 4.4, 11.5);
        if (event.key.toLowerCase() === 'a') this.panX -= step;
        if (event.key.toLowerCase() === 'd') this.panX += step;
        if (event.key.toLowerCase() === 'w') this.panY -= step;
        if (event.key.toLowerCase() === 's') this.panY += step;
        if (event.key === 'Enter' && this.hovered) this.activateCluster(this.hovered);
      });

      $$('[data-maquette-target]').forEach((button) => {
        button.addEventListener('click', () => {
          const cluster = this.clusters.find((item) => item.id === button.dataset.maquetteTarget);
          if (cluster) this.activateCluster(cluster);
        });
      });
    }

    setStatus(text) {
      const status = $('#maquette-status');
      if (status) status.textContent = text;
    }

    rotate(point) {
      const [x, y, z] = point;
      const cosRoll = Math.cos(this.roll);
      const sinRoll = Math.sin(this.roll);
      const xRoll = x * cosRoll - y * sinRoll;
      const yRoll = x * sinRoll + y * cosRoll;

      const cosPitch = Math.cos(this.pitch);
      const sinPitch = Math.sin(this.pitch);
      const yPitch = yRoll * cosPitch - z * sinPitch;
      const zPitch = yRoll * sinPitch + z * cosPitch;

      const cosYaw = Math.cos(this.yaw);
      const sinYaw = Math.sin(this.yaw);
      return [
        xRoll * cosYaw + zPitch * sinYaw,
        yPitch,
        -xRoll * sinYaw + zPitch * cosYaw,
      ];
    }

    project(point) {
      const rotated = this.rotate(point);
      const depth = rotated[2] + this.cameraDistance;
      const focal = Math.min(this.width, this.height) * 0.82;
      const scale = focal / Math.max(depth, 0.55);
      return {
        x: this.width * 0.5 + this.panX + rotated[0] * scale,
        y: this.height * 0.52 + this.panY - rotated[1] * scale,
        z: rotated[2],
        depth,
        scale,
      };
    }

    boxVertices(cluster) {
      const [ax, ay, az] = cluster.anchor;
      const [width, height, depth] = cluster.size;
      const vertices = [];
      for (const x of [-0.5, 0.5]) {
        for (const y of [-0.5, 0.5]) {
          for (const z of [-0.5, 0.5]) {
            vertices.push([ax + x * width, ay + y * height, az + z * depth]);
          }
        }
      }
      return vertices;
    }

    drawBox(cluster, active) {
      const ctx = this.context;
      const projected = this.boxVertices(cluster).map((point) => this.project(point));
      const edges = [
        [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6],
        [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
      ];
      ctx.save();
      ctx.lineWidth = active ? 1.15 : 0.55;
      ctx.strokeStyle = colorWithAlpha(active ? cluster.color : '#171715', active ? 0.84 : 0.34);
      ctx.setLineDash(active ? [] : [3, 4]);
      ctx.beginPath();
      edges.forEach(([from, to]) => {
        ctx.moveTo(projected[from].x, projected[from].y);
        ctx.lineTo(projected[to].x, projected[to].y);
      });
      ctx.stroke();
      ctx.restore();
    }

    drawSplat(splat, color, emphasis) {
      const ctx = this.context;
      const point = this.project(splat.position);
      const radius = clamp(splat.radius * point.scale, 1.2, 22);
      if (point.depth < 0.4 || radius < 0.5) return;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(splat.angle + this.roll * 0.45);
      ctx.scale(splat.stretch, 1 / Math.max(splat.stretch, 0.45));
      const alpha = splat.opacity * (emphasis ? 1.5 : 0.8);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.8);
      gradient.addColorStop(0, colorWithAlpha(color, clamp(alpha, 0, 0.5)));
      gradient.addColorStop(0.42, colorWithAlpha(color, clamp(alpha * 0.5, 0, 0.3)));
      gradient.addColorStop(1, colorWithAlpha(color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawGround() {
      const ctx = this.context;
      ctx.save();
      ctx.lineWidth = 0.5;
      for (let index = -5; index <= 5; index += 1) {
        const alpha = index === 0 ? 0.33 : 0.11;
        ctx.strokeStyle = `rgba(23, 23, 21, ${alpha})`;
        const horizontalA = this.project([-5.2, -2.35, index * 0.75]);
        const horizontalB = this.project([5.2, -2.35, index * 0.75]);
        ctx.beginPath();
        ctx.moveTo(horizontalA.x, horizontalA.y);
        ctx.lineTo(horizontalB.x, horizontalB.y);
        ctx.stroke();

        const verticalA = this.project([index * 0.75, -2.35, -5.2]);
        const verticalB = this.project([index * 0.75, -2.35, 5.2]);
        ctx.beginPath();
        ctx.moveTo(verticalA.x, verticalA.y);
        ctx.lineTo(verticalB.x, verticalB.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawLabel(cluster, anchor, active) {
      const ctx = this.context;
      const offsetX = anchor.x < this.width * 0.5 ? -78 : 22;
      const offsetY = anchor.y < this.height * 0.45 ? -25 : 26;
      const labelX = anchor.x + offsetX;
      const labelY = anchor.y + offsetY;
      ctx.save();
      ctx.strokeStyle = colorWithAlpha(active ? cluster.color : '#171715', active ? 0.85 : 0.35);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(labelX + (offsetX < 0 ? 68 : 0), labelY - 3);
      ctx.stroke();
      ctx.fillStyle = active ? cluster.color : 'rgba(23, 23, 21, 0.68)';
      ctx.font = `${active ? 700 : 600} 9px "SFMono-Regular", Consolas, monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(cluster.label, labelX, labelY);
      ctx.restore();
    }

    updateHover(x, y) {
      let nearest = null;
      let distance = 48;
      this.projectedAnchors.forEach((item) => {
        const candidateDistance = Math.hypot(item.x - x, item.y - y);
        if (candidateDistance < distance) {
          distance = candidateDistance;
          nearest = item.cluster;
        }
      });
      if (nearest !== this.hovered) {
        this.hovered = nearest;
        this.canvas.style.cursor = nearest ? 'pointer' : 'crosshair';
        this.setStatus(nearest ? `Select / ${nearest.label}` : 'Ambient orbit');
        this.updateFallbackState();
      }
    }

    activateNearest(x, y) {
      this.updateHover(x, y);
      if (this.hovered) this.activateCluster(this.hovered);
    }

    activateCluster(cluster) {
      this.selected = cluster.id;
      this.hovered = cluster;
      this.updateFallbackState();
      this.setStatus(`Selected / ${cluster.label}`);
      const destination = $(cluster.target);
      if (destination) {
        destination.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', cluster.target);
      }
    }

    updateFallbackState() {
      $$('[data-maquette-target]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.maquetteTarget === (this.hovered?.id || this.selected));
      });
    }

    render(deltaTime) {
      const ctx = this.context;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawGround();

      const emphasisId = this.hovered?.id || this.selected;
      this.clusters.forEach((cluster) => this.drawBox(cluster, cluster.id === emphasisId));

      const splats = this.clusters.flatMap((cluster) => cluster.splats.map((splat) => ({
        splat,
        cluster,
        depth: this.rotate(splat.position)[2],
      })));
      splats.sort((left, right) => left.depth - right.depth);
      splats.forEach(({ splat, cluster }) => this.drawSplat(splat, cluster.color, cluster.id === emphasisId));

      this.projectedAnchors = this.clusters.map((cluster) => ({
        ...this.project(cluster.anchor),
        cluster,
      }));
      this.projectedAnchors.forEach((anchor) => this.drawLabel(anchor.cluster, anchor, anchor.cluster.id === emphasisId));

      if (!this.drag) {
        if (!reducedMotion) this.yaw += deltaTime * 0.000035;
        this.yaw += this.velocity.yaw * deltaTime;
        this.pitch = clamp(this.pitch + this.velocity.pitch * deltaTime, -1.25, 1.25);
        this.roll += this.velocity.roll * deltaTime;
        this.panX += this.velocity.panX * deltaTime;
        this.panY += this.velocity.panY * deltaTime;
        const decay = Math.pow(0.88, deltaTime / 16.67);
        Object.keys(this.velocity).forEach((key) => { this.velocity[key] *= decay; });
      }
    }

    frame(time) {
      const deltaTime = Math.min(40, Math.max(0, time - this.lastTime));
      this.lastTime = time;
      if (this.isVisible && !document.hidden) this.render(deltaTime);
      if (!staticPreview) requestAnimationFrame(this.frame);
    }
  }

  const maquetteCanvas = $('#maquette-canvas');
  if (maquetteCanvas) new ResearchMaquette(maquetteCanvas);

  /* -------------------------------------------------------------------------- */
  /* Replay correction instrument                                               */
  /* -------------------------------------------------------------------------- */

  class ReplayInstrument {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      this.width = 0;
      this.height = 0;
      this.pixelRatio = 1;
      this.method = 'greedy';
      this.budget = 5;
      this.seed = 19;
      this.candidates = [];
      this.target = { x: 0, y: 0 };
      this.selection = [];
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      this.installControls();
      this.generateCandidates();
      this.resize();
      this.update();
    }

    installControls() {
      $$('[data-replay-method]').forEach((button) => {
        button.addEventListener('click', () => {
          this.method = button.dataset.replayMethod;
          this.update();
        });
      });

      const budget = $('#replay-budget');
      budget?.addEventListener('input', () => {
        this.budget = Number(budget.value);
        const output = $('#replay-budget-value');
        if (output) output.value = String(this.budget);
        this.update();
      });

      $('#replay-resample')?.addEventListener('click', () => {
        this.seed += 31;
        this.generateCandidates();
        this.method = 'random';
        this.update();
      });
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = bounds.width;
      this.height = bounds.height;
      this.canvas.width = Math.round(bounds.width * this.pixelRatio);
      this.canvas.height = Math.round(bounds.height * this.pixelRatio);
      this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.draw();
    }

    generateCandidates() {
      const random = mulberry32(this.seed);
      this.candidates = Array.from({ length: 18 }, (_, index) => {
        const angle = random() * Math.PI * 2;
        const radius = 0.25 + random() * 0.78;
        const biasX = index % 4 === 0 ? 0.22 : -0.03;
        const biasY = index % 5 === 0 ? 0.18 : 0.02;
        return {
          x: Math.cos(angle) * radius + biasX,
          y: Math.sin(angle) * radius * 0.78 + biasY,
        };
      });
      this.target = this.normalizedMean(this.candidates);
    }

    mean(points) {
      if (!points.length) return { x: 0, y: 0 };
      return points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    }

    normalizedMean(points) {
      const sum = this.mean(points);
      return { x: sum.x / Math.max(points.length, 1), y: sum.y / Math.max(points.length, 1) };
    }

    residual(points) {
      const candidateMean = this.normalizedMean(points);
      return Math.hypot(candidateMean.x - this.target.x, candidateMean.y - this.target.y);
    }

    randomSelection() {
      const random = mulberry32(this.seed + this.budget * 101);
      return this.candidates
        .map((point, index) => ({ point, index, key: random() }))
        .sort((left, right) => left.key - right.key)
        .slice(0, this.budget)
        .map(({ index }) => index);
    }

    greedySelection() {
      const selected = [];
      const available = new Set(this.candidates.map((_, index) => index));
      while (selected.length < this.budget && available.size) {
        let bestIndex = -1;
        let bestResidual = Number.POSITIVE_INFINITY;
        available.forEach((index) => {
          const trial = [...selected, index].map((candidateIndex) => this.candidates[candidateIndex]);
          const value = this.residual(trial);
          if (value < bestResidual) {
            bestResidual = value;
            bestIndex = index;
          }
        });
        selected.push(bestIndex);
        available.delete(bestIndex);
      }
      return selected;
    }

    update() {
      if (this.method === 'dense') {
        this.selection = this.candidates.map((_, index) => index);
      } else if (this.method === 'random') {
        this.selection = this.randomSelection();
      } else {
        this.selection = this.greedySelection();
      }

      $$('[data-replay-method]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.replayMethod === this.method));
      });

      const selectedPoints = this.selection.map((index) => this.candidates[index]);
      const value = this.residual(selectedPoints);
      const residualOutput = $('#replay-residual');
      if (residualOutput) residualOutput.value = value.toFixed(3);

      const explanation = $('#replay-explanation');
      if (explanation) {
        explanation.textContent = {
          random: 'Random selection spends the same replay budget without optimizing correction fit.',
          greedy: 'Greedy selection adds the candidate that most reduces the remaining correction mismatch.',
          dense: 'The dense candidate mean defines the zero subset-selection-mismatch reference in this conceptual instrument.',
        }[this.method];
      }
      this.draw();
    }

    map(point) {
      const paddingX = 58;
      const paddingY = 46;
      const scaleX = (this.width - paddingX * 2) / 2.25;
      const scaleY = (this.height - paddingY * 2) / 1.85;
      return {
        x: this.width * 0.5 + point.x * scaleX,
        y: this.height * 0.52 - point.y * scaleY,
      };
    }

    drawGrid() {
      const ctx = this.context;
      ctx.save();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(23, 23, 21, 0.12)';
      const step = 24;
      for (let x = 0; x <= this.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
      for (let y = 0; y <= this.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      const origin = this.map({ x: 0, y: 0 });
      ctx.strokeStyle = 'rgba(23, 23, 21, 0.62)';
      ctx.beginPath();
      ctx.moveTo(34, origin.y);
      ctx.lineTo(this.width - 24, origin.y);
      ctx.moveTo(origin.x, 22);
      ctx.lineTo(origin.x, this.height - 28);
      ctx.stroke();
      ctx.restore();
    }

    drawArrow(point, color, label, offsetY) {
      const ctx = this.context;
      const origin = this.map({ x: 0, y: 0 });
      const endpoint = this.map(point);
      const angle = Math.atan2(endpoint.y - origin.y, endpoint.x - origin.x);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(endpoint.x, endpoint.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(endpoint.x, endpoint.y);
      ctx.lineTo(endpoint.x - Math.cos(angle - 0.45) * 10, endpoint.y - Math.sin(angle - 0.45) * 10);
      ctx.lineTo(endpoint.x - Math.cos(angle + 0.45) * 10, endpoint.y - Math.sin(angle + 0.45) * 10);
      ctx.closePath();
      ctx.fill();
      ctx.font = '600 9px "SFMono-Regular", Consolas, monospace';
      ctx.fillText(label, endpoint.x + 10, endpoint.y + offsetY);
      ctx.restore();
    }

    draw() {
      if (!this.width || !this.height) return;
      const ctx = this.context;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawGrid();

      const selected = new Set(this.selection);
      this.candidates.forEach((point, index) => {
        const mapped = this.map(point);
        const isSelected = selected.has(index);
        ctx.save();
        ctx.beginPath();
        ctx.arc(mapped.x, mapped.y, isSelected ? 5.2 : 3.1, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#e44b32' : '#f5f2ea';
        ctx.strokeStyle = isSelected ? '#b93120' : 'rgba(23, 23, 21, 0.62)';
        ctx.lineWidth = isSelected ? 1 : 0.7;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      const selectedPoints = this.selection.map((index) => this.candidates[index]);
      const selectedMean = this.normalizedMean(selectedPoints);
      this.drawArrow(this.target, '#315bff', 'DESIRED CORRECTION', -10);
      this.drawArrow(selectedMean, '#e44b32', 'SELECTED MEAN', 16);
    }
  }

  const replayCanvas = $('#replay-canvas');
  if (replayCanvas) new ReplayInstrument(replayCanvas);

  /* -------------------------------------------------------------------------- */
  /* Temporal matrix                                                            */
  /* -------------------------------------------------------------------------- */

  const matrix = $('#regret-matrix-cells');
  if (matrix) {
    const random = mulberry32(2026);
    const cells = [];
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const cell = document.createElement('span');
        const region = column < row ? 'backward' : column > row ? 'forward' : 'diagonal';
        cell.className = `matrix-cell ${region}`;
        cell.style.setProperty('--matrix-alpha', (0.035 + random() * 0.18).toFixed(3));
        cell.title = `Checkpoint ${row + 1}, evaluation time ${column + 1}: ${region}`;
        cells.push(cell);
      }
    }
    matrix.replaceChildren(...cells);
  }

  /* -------------------------------------------------------------------------- */
  /* Research folio filter                                                      */
  /* -------------------------------------------------------------------------- */

  $$('[data-folio-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.folioFilter;
      $$('[data-folio-filter]').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      $$('[data-folio-status]').forEach((row) => {
        row.hidden = filter !== 'all' && row.dataset.folioStatus !== filter;
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Drawing index / command navigation                                         */
  /* -------------------------------------------------------------------------- */

  const indexDialog = $('#index-dialog');
  const indexSearch = $('#index-search');
  const indexResults = $('#index-results');
  const commands = [
    { plate: 'P.01', title: 'Intellectual trajectory', meta: 'Longitudinal section', href: '#trajectory' },
    { plate: 'M.01', title: 'Experience Replay Through the Lens of Optimization', meta: 'Replay geometry', href: '#replay' },
    { plate: 'M.02', title: 'Rank Feasibility in Continual PEFT', meta: 'Geometric diagnostic', href: '#rank' },
    { plate: 'M.03', title: 'CasePath', meta: 'Inspectable agents', href: '#casepath' },
    { plate: 'M.04', title: 'Counterfactual Window Replay for TiC-LM', meta: 'Ongoing investigation', href: '#ticlm' },
    { plate: 'R.00', title: 'Research blueprint register', meta: 'Published · revision · ongoing', href: '#folio' },
    { plate: 'F.01', title: 'Generative AI × VR / spatial intelligence', meta: 'Prospective section', href: '#frontier' },
    { plate: 'C.01', title: 'Contact', meta: 'Basel · research · systems', href: '#contact' },
    { plate: 'EXT', title: 'Google Scholar', meta: 'Publication record', href: 'https://scholar.google.com/citations?user=BFCHfngAAAAJ&hl=en' },
    { plate: 'EXT', title: 'GitHub', meta: 'Implementation record', href: 'https://github.com/KumarNavish' },
    { plate: 'EXT', title: 'OpenReview profile', meta: 'Review and discussion record', href: 'https://openreview.net/profile?id=~Navish_Kumar1' },
  ];
  let visibleCommands = commands;
  let activeCommand = 0;

  function updateCommandSelection() {
    $$('.index-result', indexResults).forEach((button, index) => {
      button.classList.toggle('is-active', index === activeCommand);
      button.setAttribute('aria-selected', String(index === activeCommand));
    });
  }

  function navigateCommand(command) {
    if (!command) return;
    indexDialog?.close();
    body.classList.remove('dialog-open');
    if (command.href.startsWith('#')) {
      $(command.href)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', command.href);
    } else {
      window.open(command.href, '_blank', 'noopener,noreferrer');
    }
  }

  function renderCommands(query = '') {
    const normalized = query.trim().toLowerCase();
    visibleCommands = commands.filter((command) => `${command.plate} ${command.title} ${command.meta}`.toLowerCase().includes(normalized));
    activeCommand = 0;
    const nodes = visibleCommands.map((command, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'index-result';
      button.setAttribute('role', 'option');
      button.innerHTML = `<span>${command.plate}</span><b>${command.title}</b><small>${command.meta}</small>`;
      button.addEventListener('mouseenter', () => {
        activeCommand = index;
        updateCommandSelection();
      });
      button.addEventListener('click', () => navigateCommand(command));
      return button;
    });
    indexResults?.replaceChildren(...nodes);
    updateCommandSelection();
  }

  function openIndex() {
    if (!indexDialog) return;
    renderCommands('');
    indexDialog.showModal();
    body.classList.add('dialog-open');
    window.setTimeout(() => {
      indexSearch.value = '';
      indexSearch.focus();
    }, 20);
  }

  $('[data-index-trigger]')?.addEventListener('click', openIndex);
  indexDialog?.addEventListener('close', () => body.classList.remove('dialog-open'));
  indexDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    indexDialog.close();
  });
  indexSearch?.addEventListener('input', () => renderCommands(indexSearch.value));
  indexSearch?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeCommand = Math.min(activeCommand + 1, visibleCommands.length - 1);
      updateCommandSelection();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeCommand = Math.max(activeCommand - 1, 0);
      updateCommandSelection();
    }
    if (event.key === 'Enter' && visibleCommands[activeCommand]) {
      event.preventDefault();
      navigateCommand(visibleCommands[activeCommand]);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && indexDialog?.open) {
      event.preventDefault();
      indexDialog.close();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (indexDialog?.open) indexDialog.close();
      else openIndex();
    }
  });

  /* -------------------------------------------------------------------------- */
  /* Contact, progress, active navigation                                       */
  /* -------------------------------------------------------------------------- */

  $('#copy-email')?.addEventListener('click', async () => {
    const status = $('#copy-status');
    try {
      await navigator.clipboard.writeText($('#copy-email').dataset.email);
      if (status) status.textContent = 'Address copied.';
    } catch (_) {
      if (status) status.textContent = 'Copy unavailable. Select the address above.';
    }
  });

  const year = $('#current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  function updateScrollProgress() {
    const total = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const ratio = clamp(window.scrollY / total, 0, 1);
    const progress = $('#scroll-progress');
    if (progress) progress.style.height = `${ratio * 100}%`;
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  updateScrollProgress();

  if ('IntersectionObserver' in window) {
    const navLinks = $$('.site-nav a');
    const sections = ['trajectory', 'monographs', 'folio', 'frontier']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle('is-active', link.hash === `#${visible.target.id}`));
    }, { rootMargin: '-24% 0px -62%', threshold: [0.02, 0.12, 0.3] });
    sections.forEach((section) => observer.observe(section));
  }
})();
