(() => {
  'use strict'

  const TAU = Math.PI * 2
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const lerp = (from, to, amount) => from + (to - from) * amount
  const easeInOut = (value) => {
    const t = clamp(value, 0, 1)
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  const WORKS = [
    {
      id: 'er',
      title: 'Experience Replay / Optimization',
      status: 'ICML 2026 submission · revision',
      category: 'Continual learning',
      tone: 'research',
      priority: 1,
      summary: 'A principled view of replay as steering online updates toward a joint-training target under a strict replay budget.',
      question: 'What update is replay actually trying to recover, and how can its failure be observed rather than guessed?',
      built: 'A correction target, Greedy Ball Replay, mismatch diagnostics, error decomposition, and controlled solver and baseline audits.',
      evidence: 'The public review record contains the controlled evidence and the decisive dense-gradient-weighting objection that now shapes the revision.',
      next: 'Clarify the compute–memory boundary and identify the regimes in which subset selection earns its complexity.',
      links: [
        ['OpenReview', 'https://openreview.net/forum?id=4z7il66fFb'],
        ['Case narrative', '#work-er'],
      ],
    },
    {
      id: 'rank',
      title: 'Rank Feasibility / Continual PEFT',
      status: 'NeurIPS 2026 submission · revision',
      category: 'Geometry and adaptation',
      tone: 'research',
      priority: 1,
      summary: 'A geometric diagnostic for asking whether a LoRA rank contains a low-norm correction that repairs old tasks without destroying current-task progress.',
      question: 'When does increasing rank add the directions a continual correction actually needs?',
      built: 'A task-wise minimum-norm quadratic program that constructs a local correction or certifies why the constraints cannot be satisfied.',
      evidence: 'Review-stage experiments extend the initial test across checkpoints, backbones, task orders, and simple baselines while preserving explicit caveats.',
      next: 'Separate local existence, optimization dynamics, generalization, and validation cost more sharply.',
      links: [
        ['OpenReview', 'https://openreview.net/forum?id=CwmHHYCbjK'],
        ['Case narrative', '#work-rank'],
      ],
    },
    {
      id: 'ticlm',
      title: 'Counterfactual Window Replay',
      status: 'Ongoing · TiC-LM',
      category: 'Time-continual language models',
      tone: 'frontier',
      priority: 1,
      summary: 'A replay controller that asks whether historical tokens improve the temporal regret row more than the current tokens they displace.',
      question: 'When should a historical window be replayed, and when should replay disappear entirely?',
      built: 'A counterfactual objective, local window-value estimates, uncertainty-aware allocation, and an explicit no-replay solution.',
      evidence: 'The present stage is a bounded replication and controller study grounded in the TiC-LM temporal evaluation structure.',
      next: 'Measure replay half-life and test whether stable and fast-evolving domains emerge as observable value curves.',
      links: [
        ['TiC-LM benchmark', 'https://github.com/apple/ml-tic-lm'],
        ['Case narrative', '#work-ticlm'],
      ],
    },
    {
      id: 'casepath',
      title: 'CasePath',
      status: 'Live agentic system',
      category: 'Process intelligence',
      tone: 'system',
      priority: 1,
      summary: 'A guarded multi-agent workspace that keeps facts, authority, process decisions, documents, and final claims aligned in one inspectable trace.',
      question: 'How can agentic assistance remain useful when procedural errors carry real consequences?',
      built: 'Typed shared state, source-integrity checks, six bounded agents, deterministic evidence and process gates, live audit events, and fail-closed execution.',
      evidence: 'The deployed workspace exposes the full Sources → Build → Docs → Check workflow and its run receipts.',
      next: 'Turn bounded process induction into a repeatable scientific evaluation of procedural expertise capture.',
      links: [
        ['Live system', 'https://casepath.kumarnavish.chatgpt.site/'],
        ['Case narrative', '#work-casepath'],
      ],
    },
    {
      id: 'spatial',
      title: 'GenAI × Spatial Computing',
      status: 'Active frontier · prototype direction',
      category: 'Emerging interfaces',
      tone: 'frontier',
      priority: 1,
      summary: 'An end-to-end direction for turning voice or text into interactive 6DoF environments rather than flat generated media.',
      question: 'What changes when an intelligent system generates a place that people can enter and alter?',
      built: 'A systems architecture spanning world generation, interaction, scene continuity, spatial audio, Quest-class runtime constraints, and evaluation.',
      evidence: 'Current work is explicitly exploratory; the portfolio distinguishes the product thesis from completed evidence.',
      next: 'Produce a repeatable live demo whose world remains coherent under user action without manual intervention.',
      links: [['Frontier thesis', '#frontier']],
    },
    {
      id: 'ngvi',
      title: 'Square-root Natural-Gradient VI',
      status: 'Published research · 2025',
      category: 'Optimization guarantees',
      tone: 'research',
      priority: 2,
      summary: 'Convergence guarantees for natural-gradient variational Gaussian inference using square-root covariance geometry.',
      question: 'Can practical natural-gradient behavior be made formally tractable without discarding its useful geometry?',
      built: 'Discrete and continuous-time convergence analysis with empirical comparison across optimization geometries.',
      evidence: 'Public paper and reproducible mathematical claims.',
      next: 'Connect geometric guarantees more directly to adaptive and continual inference settings.',
      links: [['Paper', 'https://arxiv.org/abs/2507.07853']],
    },
    {
      id: 'urban',
      title: 'Urban Micro-region Logistics',
      status: 'Applied ML · 2023',
      category: 'Operational modeling',
      tone: 'system',
      priority: 2,
      summary: 'Spatial modeling of delivery performance to make cargo-bike transition decisions testable at neighborhood scale.',
      question: 'Where can a sustainability objective be converted into a concrete operational decision?',
      built: 'H3 spatial indexing, OpenStreetMap feature aggregation, and service-time modeling across urban micro-regions.',
      evidence: 'Public paper, datasets, and decision-oriented modeling pipeline.',
      next: 'Close the loop between predictive models, fleet allocation, and real operational feedback.',
      links: [['Paper', 'https://arxiv.org/abs/2301.12887']],
    },
    {
      id: 'social',
      title: 'Counterspeech Dynamics',
      status: 'Published research · 2020',
      category: 'Social computing',
      tone: 'research',
      priority: 2,
      summary: 'A dataset-backed study of how hate and counterspeech users differ in behavior, language, and interaction strategy.',
      question: 'Can interventions reduce harm without relying only on blunt account removal?',
      built: 'Annotated paired-user data with lexical, linguistic, and psycholinguistic analysis.',
      evidence: 'Peer-reviewed publication and released dataset.',
      next: 'Move from aggregate behavior analysis toward causal and intervention-aware evaluation.',
      links: [['Paper', 'https://dl.acm.org/doi/10.1145/3371158.3371172']],
    },
    {
      id: 'gain',
      title: 'Gain-Laplacian Structure',
      status: 'Published foundations · 2020–2021',
      category: 'Spectral graph theory',
      tone: 'research',
      priority: 2,
      summary: 'Normalized operators and extremal eigenvalue bounds for gain graphs, linking imbalance measures to spectral structure.',
      question: 'Which graph invariants explain and constrain the behavior of structured operators?',
      built: 'Operator definitions, interlacing extensions, balance and bipartiteness analysis, and explicit eigenvalue bounds.',
      evidence: 'Published mathematical work in Linear Algebra and its Applications and public preprints.',
      next: 'Use the structural viewpoint where graph geometry constrains learning and control.',
      links: [
        ['Eigenvalue bounds', 'https://www.sciencedirect.com/science/article/pii/S0024379521002111'],
        ['Normalized Laplacians', 'https://arxiv.org/abs/2009.13788'],
      ],
    },
  ]

  const LAYOUTS = {
    constellation: {
      er: [-300, -92, 75],
      rank: [300, -142, -10],
      ticlm: [-170, -245, 155],
      casepath: [90, 226, 170],
      spatial: [330, 100, 80],
      ngvi: [-350, 155, -55],
      urban: [-30, 300, -15],
      social: [365, 245, -125],
      gain: [-420, 15, 125],
    },
    trajectory: {
      social: [-460, 160, 30],
      gain: [-350, 55, 70],
      urban: [-180, 205, 10],
      ngvi: [10, -20, 40],
      er: [205, -165, 65],
      rank: [300, -65, 40],
      ticlm: [390, 50, 120],
      casepath: [270, 180, 95],
      spatial: [430, 255, 165],
    },
    frontier: {
      social: [-410, 210, -170],
      gain: [-370, 65, -130],
      urban: [-260, 265, -110],
      ngvi: [-230, -85, -80],
      er: [5, -150, 45],
      rank: [65, -35, 75],
      casepath: [10, 175, 90],
      ticlm: [300, -155, 170],
      spatial: [370, 130, 225],
    },
  }

  const EDGES = [
    ['core', 'er'], ['core', 'rank'], ['core', 'ticlm'], ['core', 'casepath'], ['core', 'spatial'],
    ['gain', 'ngvi'], ['ngvi', 'rank'], ['ngvi', 'er'], ['er', 'ticlm'], ['rank', 'ticlm'],
    ['urban', 'casepath'], ['social', 'casepath'], ['casepath', 'spatial'], ['ticlm', 'spatial'],
  ]

  const QUESTIONS = {
    adaptation: {
      label: 'Recurring question / adaptation',
      title: 'How should a learner change without erasing what remains useful?',
      summary: 'This question runs from replay in online continual learning to time-continual language-model pretraining. The object changes—from examples, to gradients, to historical token windows—but the decision remains the same: what should be preserved, at what cost, and relative to which alternative?',
      evidence: [
        ['Experience Replay / OpenReview', 'https://openreview.net/forum?id=4z7il66fFb'],
        ['Counterfactual Window Replay', '#work-ticlm'],
        ['Continual PEFT feasibility', 'https://openreview.net/forum?id=CwmHHYCbjK'],
      ],
    },
    geometry: {
      label: 'Recurring question / geometry',
      title: 'Which structural constraints make a correction possible?',
      summary: 'Spectral graph theory, natural-gradient geometry, and LoRA feasibility all ask a version of the same question: which directions exist, which are forbidden, and which invariant determines whether a desired change can be realized?',
      evidence: [
        ['Rank Feasibility', 'https://openreview.net/forum?id=CwmHHYCbjK'],
        ['Natural-gradient guarantees', 'https://arxiv.org/abs/2507.07853'],
        ['Gain-Laplacian bounds', 'https://www.sciencedirect.com/science/article/pii/S0024379521002111'],
      ],
    },
    evidence: {
      label: 'Recurring question / evidence',
      title: 'What turns a formal mechanism into a practical decision?',
      summary: 'A theory is not complete when it merely yields a method. It must expose diagnostics, survive realistic baselines, reveal failure modes, and change an actual decision. The portfolio intentionally keeps reviewer objections, negative boundaries, and operational constraints visible.',
      evidence: [
        ['ER public review record', 'https://openreview.net/forum?id=4z7il66fFb'],
        ['Rank public review record', 'https://openreview.net/forum?id=CwmHHYCbjK'],
        ['CasePath live trace', 'https://casepath.kumarnavish.chatgpt.site/'],
      ],
    },
    interfaces: {
      label: 'Recurring question / interfaces',
      title: 'How should intelligent systems become spatial, legible, and usable?',
      summary: 'The frontier is not “AI plus a headset” as a keyword. It is a systems question about generated worlds, human action, continuity, provenance, uncertainty, and the boundary between immersive and deliberately flat interaction.',
      evidence: [
        ['Spatial computing thesis', '#frontier'],
        ['CasePath as legible agentic work', 'https://casepath.kumarnavish.chatgpt.site/'],
        ['Portfolio as interactive evidence', '#top'],
      ],
    },
  }

  const sceneShell = document.querySelector('[data-scene-shell]')
  const canvas = document.getElementById('atlas-canvas')
  const context = canvas.getContext('2d', { alpha: true })
  const nodeLayer = document.getElementById('node-layer')
  const motionToggle = document.querySelector('[data-motion-toggle]')
  const film = document.querySelector('[data-atlas-film]')
  const focusPanel = document.querySelector('[data-focus-panel]')
  const focusSheet = focusPanel.querySelector('.focus-panel-sheet')
  const commandDialog = document.querySelector('[data-command-dialog]')
  const commandInput = document.querySelector('[data-command-input]')
  const commandResults = document.querySelector('[data-command-results]')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  if (!sceneShell || !canvas || !context || !nodeLayer) {
    return
  }

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    compact: false,
    visible: true,
    motionPaused: reducedMotion.matches,
    layout: 'constellation',
    layoutProgress: 1,
    layoutStartedAt: performance.now(),
    positions: new Map(),
    fromPositions: new Map(),
    targetPositions: new Map(),
    nodeElements: new Map(),
    projected: new Map(),
    camera: {
      yaw: -0.16,
      pitch: -0.035,
      distance: 860,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
    },
    desiredCamera: {
      yaw: -0.16,
      pitch: -0.035,
      distance: 860,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
    },
    pointer: { x: 0, y: 0 },
    drag: { active: false, x: 0, y: 0 },
    introStartedAt: performance.now(),
    introComplete: reducedMotion.matches,
    highlightedId: null,
    focusedId: null,
    tourToken: 0,
    currentTour: false,
    lastFrame: performance.now(),
    stars: [],
  }

  function vectorFrom(layout, id) {
    const position = layout[id] || [0, 0, 0]
    return { x: position[0], y: position[1], z: position[2] }
  }

  function cloneVector(vector) {
    return { x: vector.x, y: vector.y, z: vector.z }
  }

  function buildNodes() {
    for (const work of WORKS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'atlas-node'
      button.dataset.nodeId = work.id
      button.dataset.tone = work.tone
      button.setAttribute('aria-label', `${work.title}. ${work.status}. Open details.`)
      button.innerHTML = `
        <span class="node-orb" aria-hidden="true"></span>
        <span class="node-title">${work.title}</span>
        <span class="node-status">${work.status}</span>
        <span class="node-arrow" aria-hidden="true">↗</span>
      `
      button.addEventListener('click', () => openFocus(work.id))
      button.addEventListener('pointerenter', () => {
        if (!state.currentTour) state.highlightedId = work.id
      })
      button.addEventListener('pointerleave', () => {
        if (!state.currentTour && state.focusedId !== work.id) state.highlightedId = null
      })
      nodeLayer.append(button)
      state.nodeElements.set(work.id, button)

      const start = vectorFrom(LAYOUTS.constellation, work.id)
      state.positions.set(work.id, cloneVector(start))
      state.fromPositions.set(work.id, cloneVector(start))
      state.targetPositions.set(work.id, cloneVector(start))
    }

    const core = document.createElement('div')
    core.className = 'atlas-core-label'
    core.innerHTML = '<strong>Navish Kumar</strong><span>research → systems → interfaces</span>'
    nodeLayer.append(core)
    state.nodeElements.set('core', core)
  }

  function generateStars() {
    const count = state.compact ? 70 : 150
    state.stars = Array.from({ length: count }, (_, index) => ({
      x: ((index * 71) % 997) / 997,
      y: ((index * 193) % 991) / 991,
      depth: 0.25 + (((index * 43) % 100) / 100) * 0.75,
      size: 0.35 + (((index * 17) % 100) / 100) * 1.25,
      phase: ((index * 29) % 100) / 100 * TAU,
    }))
  }

  function resizeCanvas() {
    const rect = sceneShell.getBoundingClientRect()
    state.width = Math.max(1, rect.width)
    state.height = Math.max(1, rect.height)
    state.compact = state.width < 760
    state.dpr = Math.min(window.devicePixelRatio || 1, 1.7)
    canvas.width = Math.round(state.width * state.dpr)
    canvas.height = Math.round(state.height * state.dpr)
    canvas.style.width = `${state.width}px`
    canvas.style.height = `${state.height}px`
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
    generateStars()

    if (state.compact) {
      state.desiredCamera.distance = Math.max(state.desiredCamera.distance, 900)
    }
  }

  function setLayout(name, immediate = false) {
    if (!LAYOUTS[name]) return
    state.layout = name
    state.layoutStartedAt = performance.now()
    state.layoutProgress = immediate ? 1 : 0

    for (const work of WORKS) {
      const current = state.positions.get(work.id) || vectorFrom(LAYOUTS[name], work.id)
      state.fromPositions.set(work.id, cloneVector(current))
      state.targetPositions.set(work.id, vectorFrom(LAYOUTS[name], work.id))
    }

    document.querySelectorAll('[data-layout]').forEach((button) => {
      const active = button.dataset.layout === name
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    })

    document.querySelector('[data-scene-live]').textContent = `Atlas changed to ${name} layout.`
  }

  function updatePositions(now) {
    if (state.layoutProgress >= 1) return
    state.layoutProgress = clamp((now - state.layoutStartedAt) / 1100, 0, 1)
    const amount = easeInOut(state.layoutProgress)
    for (const work of WORKS) {
      const from = state.fromPositions.get(work.id)
      const target = state.targetPositions.get(work.id)
      const current = state.positions.get(work.id)
      current.x = lerp(from.x, target.x, amount)
      current.y = lerp(from.y, target.y, amount)
      current.z = lerp(from.z, target.z, amount)
    }
  }

  function updateCamera(delta) {
    const response = 1 - Math.pow(0.001, delta)
    const camera = state.camera
    const desired = state.desiredCamera
    camera.yaw = lerp(camera.yaw, desired.yaw, response)
    camera.pitch = lerp(camera.pitch, desired.pitch, response)
    camera.distance = lerp(camera.distance, desired.distance, response)
    camera.targetX = lerp(camera.targetX, desired.targetX, response)
    camera.targetY = lerp(camera.targetY, desired.targetY, response)
    camera.targetZ = lerp(camera.targetZ, desired.targetZ, response)
  }

  function project(position) {
    const camera = state.camera
    const worldScale = state.compact ? 0.64 : state.width < 1050 ? 0.82 : 1
    let x = (position.x - camera.targetX) * worldScale
    let y = (position.y - camera.targetY) * worldScale
    let z = (position.z - camera.targetZ) * worldScale

    const cosY = Math.cos(camera.yaw)
    const sinY = Math.sin(camera.yaw)
    const rotatedX = cosY * x - sinY * z
    const rotatedZ = sinY * x + cosY * z

    const cosX = Math.cos(camera.pitch)
    const sinX = Math.sin(camera.pitch)
    const rotatedY = cosX * y - sinX * rotatedZ
    const finalZ = sinX * y + cosX * rotatedZ

    const depth = Math.max(150, camera.distance + finalZ)
    const fov = state.compact ? 610 : 720
    const scale = fov / depth
    const originX = state.compact ? state.width * 0.5 : state.width * 0.69
    const originY = state.compact ? state.height * 0.82 : state.height * 0.51

    return {
      x: originX + rotatedX * scale,
      y: originY + rotatedY * scale,
      z: finalZ,
      depth,
      scale,
      visible: depth > 170 && depth < 1500,
    }
  }

  function setNodeTransforms(now) {
    const introElapsed = (now - state.introStartedAt) / 1000
    const sorted = []

    for (let index = 0; index < WORKS.length; index += 1) {
      const work = WORKS[index]
      const element = state.nodeElements.get(work.id)
      const position = state.positions.get(work.id)
      const point = project(position)
      state.projected.set(work.id, point)

      const hideSecondary = state.compact && work.priority > 1
      const intro = state.introComplete ? 1 : clamp((introElapsed - 0.45 - index * 0.09) * 1.45, 0, 1)
      const edgeFade = clamp(Math.min(point.x, state.width - point.x, point.y, state.height - point.y) / 80, 0, 1)
      const depthFade = clamp((1450 - point.depth) / 520, 0.18, 1)
      const highlight = state.highlightedId === work.id || state.focusedId === work.id
      const dimmed = state.highlightedId && !highlight
      const opacity = hideSecondary || !point.visible ? 0 : intro * edgeFade * depthFade * (dimmed ? 0.26 : 1)
      const displayScale = clamp(point.scale * (highlight ? 1.08 : 1), state.compact ? 0.62 : 0.54, 1.18)
      const width = element.offsetWidth || 180
      const height = element.offsetHeight || 90

      element.style.opacity = opacity.toFixed(3)
      element.style.pointerEvents = opacity < 0.12 ? 'none' : 'auto'
      element.style.transform = `translate3d(${(point.x - width / 2).toFixed(2)}px, ${(point.y - height / 2).toFixed(2)}px, 0) scale(${displayScale.toFixed(3)})`
      element.classList.toggle('is-focused', Boolean(highlight))
      sorted.push([element, point.depth])
    }

    const corePoint = project({ x: 0, y: 0, z: 0 })
    state.projected.set('core', corePoint)
    const core = state.nodeElements.get('core')
    const coreOpacity = state.introComplete ? 1 : clamp((introElapsed - 0.95) * 1.35, 0, 1)
    core.style.opacity = coreOpacity.toFixed(3)
    core.style.transform = `translate3d(${(corePoint.x - 75).toFixed(2)}px, ${(corePoint.y + 78).toFixed(2)}px, 0) scale(${clamp(corePoint.scale, 0.72, 1.04).toFixed(3)})`

    sorted.sort((left, right) => right[1] - left[1]).forEach(([element], index) => {
      element.style.zIndex = String(index + 1)
    })

    if (!state.introComplete && introElapsed > 1.8) {
      state.introComplete = true
    }
  }

  function drawBackground(now) {
    context.clearRect(0, 0, state.width, state.height)

    const gradient = context.createRadialGradient(
      state.compact ? state.width * 0.5 : state.width * 0.69,
      state.compact ? state.height * 0.73 : state.height * 0.51,
      10,
      state.width * 0.68,
      state.height * 0.5,
      Math.max(state.width, state.height) * 0.65,
    )
    gradient.addColorStop(0, 'rgba(37, 100, 132, 0.13)')
    gradient.addColorStop(0.32, 'rgba(14, 29, 43, 0.07)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, state.width, state.height)

    for (const star of state.stars) {
      const driftX = state.motionPaused ? 0 : Math.sin(now * 0.00005 * star.depth + star.phase) * 5
      const driftY = state.motionPaused ? 0 : Math.cos(now * 0.00004 * star.depth + star.phase) * 3
      const x = star.x * state.width + driftX + state.pointer.x * star.depth * 5
      const y = star.y * state.height + driftY + state.pointer.y * star.depth * 3
      const alpha = 0.08 + star.depth * 0.25 * (0.75 + Math.sin(now * 0.001 + star.phase) * 0.25)
      context.fillStyle = `rgba(190, 220, 240, ${alpha.toFixed(3)})`
      context.beginPath()
      context.arc(x, y, star.size, 0, TAU)
      context.fill()
    }
  }

  function drawGrid() {
    context.save()
    context.lineWidth = 0.6
    for (let index = -6; index <= 6; index += 1) {
      const a = project({ x: index * 95, y: 350, z: -550 })
      const b = project({ x: index * 95, y: 350, z: 550 })
      context.strokeStyle = 'rgba(150, 190, 220, 0.055)'
      context.beginPath()
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
      context.stroke()
    }
    for (let index = -6; index <= 7; index += 1) {
      const a = project({ x: -600, y: 350, z: index * 90 })
      const b = project({ x: 600, y: 350, z: index * 90 })
      context.strokeStyle = 'rgba(150, 190, 220, 0.048)'
      context.beginPath()
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
      context.stroke()
    }
    context.restore()
  }

  function drawTower(now) {
    const core = state.projected.get('core')
    if (!core) return

    const top = project({ x: 0, y: -210, z: 0 })
    const bottom = project({ x: 0, y: 180, z: 0 })
    const glow = context.createLinearGradient(0, top.y, 0, bottom.y)
    glow.addColorStop(0, 'rgba(95, 212, 255, 0.02)')
    glow.addColorStop(0.5, 'rgba(95, 212, 255, 0.3)')
    glow.addColorStop(1, 'rgba(159, 140, 255, 0.03)')

    context.save()
    context.globalCompositeOperation = 'lighter'
    context.strokeStyle = glow
    context.lineWidth = state.compact ? 1 : 1.2

    const columns = state.compact ? 8 : 14
    for (let index = 0; index < columns; index += 1) {
      const angle = (index / columns) * TAU + (state.motionPaused ? 0 : now * 0.00009)
      const radius = 28 + Math.sin(angle * 3) * 5
      const upper = project({ x: Math.cos(angle) * radius, y: -205, z: Math.sin(angle) * radius })
      const lower = project({ x: Math.cos(angle) * radius, y: 180, z: Math.sin(angle) * radius })
      context.globalAlpha = 0.15 + ((index % 4) / 4) * 0.25
      context.beginPath()
      context.moveTo(upper.x, upper.y)
      context.lineTo(lower.x, lower.y)
      context.stroke()
    }

    context.globalAlpha = 0.85
    const pulse = state.motionPaused ? 0.5 : (Math.sin(now * 0.0013) + 1) / 2
    const coreGradient = context.createRadialGradient(core.x, core.y, 0, core.x, core.y, 80 + pulse * 20)
    coreGradient.addColorStop(0, 'rgba(95, 212, 255, 0.32)')
    coreGradient.addColorStop(0.25, 'rgba(95, 212, 255, 0.1)')
    coreGradient.addColorStop(1, 'rgba(95, 212, 255, 0)')
    context.fillStyle = coreGradient
    context.beginPath()
    context.arc(core.x, core.y, 90 + pulse * 16, 0, TAU)
    context.fill()

    context.globalAlpha = 1
    context.strokeStyle = 'rgba(95, 212, 255, 0.24)'
    for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
      const radius = 45 + ringIndex * 27 + pulse * (ringIndex + 1) * 2
      context.beginPath()
      context.ellipse(core.x, bottom.y + 4, radius, radius * 0.24, -0.08, 0, TAU)
      context.stroke()
    }
    context.restore()
  }

  function edgeColor(id) {
    const work = WORKS.find((item) => item.id === id)
    if (!work) return [95, 212, 255]
    if (work.tone === 'frontier') return [159, 140, 255]
    if (work.tone === 'system') return [134, 247, 212]
    return [95, 212, 255]
  }

  function drawConnections(now) {
    const intro = state.introComplete ? 1 : clamp((now - state.introStartedAt - 520) / 1300, 0, 1)
    context.save()
    context.lineWidth = 0.85

    EDGES.forEach(([fromId, toId], edgeIndex) => {
      const from = state.projected.get(fromId)
      const to = state.projected.get(toId)
      if (!from || !to) return
      if (state.compact) {
        const targetWork = WORKS.find((item) => item.id === toId)
        const sourceWork = WORKS.find((item) => item.id === fromId)
        if ((targetWork && targetWork.priority > 1) || (sourceWork && sourceWork.priority > 1)) return
      }

      const highlighted = !state.highlightedId || fromId === state.highlightedId || toId === state.highlightedId
      const [red, green, blue] = edgeColor(toId)
      const alpha = intro * (highlighted ? 0.24 : 0.045)
      const middleX = (from.x + to.x) / 2 + (to.y - from.y) * 0.08
      const middleY = (from.y + to.y) / 2 - (to.x - from.x) * 0.04

      context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`
      context.beginPath()
      context.moveTo(from.x, from.y)
      context.quadraticCurveTo(middleX, middleY, to.x, to.y)
      context.stroke()

      if (!state.motionPaused && highlighted && intro > 0.8) {
        const progress = (now * 0.00012 + edgeIndex * 0.17) % 1
        const oneMinus = 1 - progress
        const pulseX = oneMinus * oneMinus * from.x + 2 * oneMinus * progress * middleX + progress * progress * to.x
        const pulseY = oneMinus * oneMinus * from.y + 2 * oneMinus * progress * middleY + progress * progress * to.y
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.74)`
        context.beginPath()
        context.arc(pulseX, pulseY, 1.5, 0, TAU)
        context.fill()
      }
    })
    context.restore()
  }

  function renderFrame(now) {
    if (!state.visible) {
      state.lastFrame = now
      requestAnimationFrame(renderFrame)
      return
    }

    const elapsed = Math.min((now - state.lastFrame) / 1000, 0.05)
    state.lastFrame = now

    if (!state.motionPaused) {
      updatePositions(now)
      updateCamera(elapsed)
    }

    setNodeTransforms(now)
    drawBackground(now)
    drawGrid()
    drawConnections(now)
    drawTower(now)

    requestAnimationFrame(renderFrame)
  }

  function focusCameraOn(id, zoom = 650) {
    const position = state.positions.get(id)
    if (!position) return
    state.desiredCamera.targetX = position.x * 0.84
    state.desiredCamera.targetY = position.y * 0.84
    state.desiredCamera.targetZ = position.z * 0.84
    state.desiredCamera.distance = state.compact ? 820 : zoom
  }

  function resetCamera() {
    state.desiredCamera.targetX = 0
    state.desiredCamera.targetY = 0
    state.desiredCamera.targetZ = 0
    state.desiredCamera.distance = state.compact ? 930 : 860
    state.desiredCamera.yaw = -0.16
    state.desiredCamera.pitch = -0.035
  }

  function wait(duration, token) {
    return new Promise((resolve) => {
      const started = performance.now()
      const check = () => {
        if (token !== state.tourToken) return resolve(false)
        if (performance.now() - started >= duration) return resolve(true)
        window.setTimeout(check, 40)
      }
      check()
    })
  }

  async function runGuidedTour() {
    if (state.motionPaused) setMotionPaused(false)
    const token = ++state.tourToken
    state.currentTour = true
    document.querySelector('[data-tour-skip]').hidden = false
    setLayout('constellation')
    resetCamera()
    document.querySelector('[data-scene-live]').textContent = 'Guided atlas started.'

    const sequence = [
      ['er', 1800],
      ['rank', 1800],
      ['ticlm', 1800],
      ['casepath', 1800],
      ['spatial', 2100],
    ]

    for (const [id, duration] of sequence) {
      if (token !== state.tourToken) break
      state.highlightedId = id
      focusCameraOn(id, id === 'spatial' ? 610 : 660)
      const work = WORKS.find((item) => item.id === id)
      document.querySelector('[data-scene-live]').textContent = `${work.title}. ${work.status}.`
      const continued = await wait(duration, token)
      if (!continued) break
    }

    if (token === state.tourToken) {
      state.highlightedId = null
      resetCamera()
      state.currentTour = false
      document.querySelector('[data-tour-skip]').hidden = true
      document.querySelector('[data-scene-live]').textContent = 'Guided atlas complete. Explore manually.'
    }
  }

  function stopTour() {
    state.tourToken += 1
    state.currentTour = false
    state.highlightedId = null
    resetCamera()
    document.querySelector('[data-tour-skip]').hidden = true
    document.querySelector('[data-scene-live]').textContent = 'Manual exploration enabled.'
  }

  function populateFocus(work) {
    focusPanel.querySelector('[data-focus-category]').textContent = work.category
    focusPanel.querySelector('[data-focus-title]').textContent = work.title
    focusPanel.querySelector('[data-focus-status]').textContent = work.status
    focusPanel.querySelector('[data-focus-summary]').textContent = work.summary
    focusPanel.querySelector('[data-focus-question]').textContent = work.question
    focusPanel.querySelector('[data-focus-built]').textContent = work.built
    focusPanel.querySelector('[data-focus-evidence]').textContent = work.evidence
    focusPanel.querySelector('[data-focus-next]').textContent = work.next
    const links = focusPanel.querySelector('[data-focus-links]')
    links.innerHTML = ''
    for (const [label, url] of work.links) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.textContent = label
      anchor.innerHTML += '<span aria-hidden="true">↗</span>'
      if (url.startsWith('http')) {
        anchor.target = '_blank'
        anchor.rel = 'noreferrer'
      } else {
        anchor.addEventListener('click', closeFocus)
      }
      links.append(anchor)
    }
  }

  let lastFocusedElement = null

  function openFocus(id) {
    const work = WORKS.find((item) => item.id === id)
    if (!work) return
    stopTour()
    lastFocusedElement = document.activeElement
    state.focusedId = id
    state.highlightedId = id
    focusCameraOn(id, 620)
    populateFocus(work)
    focusPanel.classList.add('is-open')
    focusPanel.setAttribute('aria-hidden', 'false')
    document.body.classList.add('is-locked')
    window.setTimeout(() => focusSheet.focus(), 40)
  }

  function closeFocus() {
    focusPanel.classList.remove('is-open')
    focusPanel.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('is-locked')
    state.focusedId = null
    state.highlightedId = null
    resetCamera()
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus()
  }

  function setMotionPaused(paused) {
    state.motionPaused = paused
    document.documentElement.classList.toggle('motion-paused', paused)
    motionToggle.setAttribute('aria-pressed', String(paused))
    const label = motionToggle.querySelector('.topbar-action-label')
    if (label) label.textContent = paused ? 'Resume motion' : 'Pause motion'
    if (film) {
      if (paused) film.pause()
      else film.play().catch(() => {})
    }
    document.querySelector('[data-scene-live]').textContent = paused ? 'Motion paused.' : 'Motion resumed.'
  }

  function updateQuestion(key) {
    const question = QUESTIONS[key]
    if (!question) return
    document.querySelectorAll('[data-question]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.question === key)
    })
    const detail = document.querySelector('[data-question-detail]')
    detail.innerHTML = `
      <p class="question-detail-label">${question.label}</p>
      <h3>${question.title}</h3>
      <p>${question.summary}</p>
      <div class="question-evidence">
        ${question.evidence.map(([label, url]) => `<a href="${url}" ${url.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}><span>${label}</span><i aria-hidden="true">↗</i></a>`).join('')}
      </div>
    `
  }

  function renderCommandResults(query = '') {
    const normalized = query.trim().toLowerCase()
    const results = WORKS.filter((work) => {
      if (!normalized) return work.priority === 1
      return `${work.title} ${work.status} ${work.category} ${work.summary} ${work.question}`.toLowerCase().includes(normalized)
    }).slice(0, 8)

    commandResults.innerHTML = ''
    if (results.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'command-result-empty'
      empty.textContent = 'No matching work. Try replay, rank, spatial, optimization, or CasePath.'
      commandResults.append(empty)
      return
    }

    results.forEach((work, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `command-result${index === 0 ? ' is-selected' : ''}`
      button.innerHTML = `<span><strong>${work.title}</strong><small>${work.category} · ${work.status}</small></span><span aria-hidden="true">↗</span>`
      button.addEventListener('click', () => {
        commandDialog.close()
        openFocus(work.id)
      })
      commandResults.append(button)
    })
  }

  function openCommand() {
    if (typeof commandDialog.showModal === 'function') {
      renderCommandResults('')
      commandDialog.showModal()
      window.setTimeout(() => commandInput.focus(), 20)
    }
  }

  async function loadMetrics() {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 4200)
    try {
      const [profileResponse, metricsResponse] = await Promise.all([
        fetch('/api/v1/profile.json', { signal: controller.signal }),
        fetch('/api/v1/metrics.json', { signal: controller.signal }),
      ])
      if (!profileResponse.ok || !metricsResponse.ok) throw new Error('metric feed unavailable')
      const profile = await profileResponse.json()
      const metrics = await metricsResponse.json()
      document.querySelector('[data-metric="projects"]').textContent = String(profile?.counts?.projects ?? '—')
      document.querySelector('[data-metric="papers"]').textContent = String(metrics?.works_count ?? profile?.counts?.publications ?? '—')
      document.querySelector('[data-metric="citations"]').textContent = String(metrics?.citations_total ?? '—')
    } catch {
      document.querySelector('[data-metric="projects"]').textContent = 'Live'
      document.querySelector('[data-metric="papers"]').textContent = 'Public'
      document.querySelector('[data-metric="citations"]').textContent = 'Open'
    } finally {
      window.clearTimeout(timeout)
    }
  }

  function onPointerDown(event) {
    if (event.target.closest('button, a')) return
    stopTour()
    state.drag.active = true
    state.drag.x = event.clientX
    state.drag.y = event.clientY
    sceneShell.classList.add('is-dragging')
    sceneShell.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    const rect = sceneShell.getBoundingClientRect()
    state.pointer.x = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5)
    state.pointer.y = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5)

    if (!state.drag.active) return
    const deltaX = event.clientX - state.drag.x
    const deltaY = event.clientY - state.drag.y
    state.drag.x = event.clientX
    state.drag.y = event.clientY
    state.desiredCamera.yaw += deltaX * 0.0042
    state.desiredCamera.pitch = clamp(state.desiredCamera.pitch + deltaY * 0.0032, -0.42, 0.35)
  }

  function onPointerUp(event) {
    state.drag.active = false
    sceneShell.classList.remove('is-dragging')
    sceneShell.releasePointerCapture?.(event.pointerId)
  }

  function onWheel(event) {
    if (Math.abs(event.deltaY) < 2) return
    stopTour()
    state.desiredCamera.distance = clamp(state.desiredCamera.distance + event.deltaY * 0.42, state.compact ? 720 : 540, 1250)
  }

  function onSceneKeydown(event) {
    const amount = event.shiftKey ? 0.2 : 0.08
    if (event.key === 'ArrowLeft') {
      state.desiredCamera.yaw -= amount
      event.preventDefault()
    } else if (event.key === 'ArrowRight') {
      state.desiredCamera.yaw += amount
      event.preventDefault()
    } else if (event.key === 'ArrowUp') {
      state.desiredCamera.pitch = clamp(state.desiredCamera.pitch - amount, -0.42, 0.35)
      event.preventDefault()
    } else if (event.key === 'ArrowDown') {
      state.desiredCamera.pitch = clamp(state.desiredCamera.pitch + amount, -0.42, 0.35)
      event.preventDefault()
    } else if (event.key === '+' || event.key === '=') {
      state.desiredCamera.distance = clamp(state.desiredCamera.distance - 60, 540, 1250)
      event.preventDefault()
    } else if (event.key === '-') {
      state.desiredCamera.distance = clamp(state.desiredCamera.distance + 60, 540, 1250)
      event.preventDefault()
    }
  }

  function updateScrollUi() {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const progress = clamp(window.scrollY / scrollable, 0, 1)
    document.querySelector('.page-progress span').style.transform = `scaleX(${progress})`
    document.querySelector('[data-topbar]').classList.toggle('is-scrolled', window.scrollY > 24)
  }

  function installNavigationObserver() {
    const links = Array.from(document.querySelectorAll('.primary-nav a'))
    const targets = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean)
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      links.forEach((link) => link.setAttribute('aria-current', String(link.getAttribute('href') === `#${visible.target.id}`)))
    }, { rootMargin: '-28% 0px -58% 0px', threshold: [0, 0.2, 0.6] })
    targets.forEach((target) => observer.observe(target))
  }

  buildNodes()
  resizeCanvas()
  setLayout('constellation', true)
  setMotionPaused(state.motionPaused)
  updateQuestion('adaptation')
  loadMetrics()
  installNavigationObserver()
  updateScrollUi()

  sceneShell.addEventListener('pointerdown', onPointerDown)
  sceneShell.addEventListener('pointermove', onPointerMove)
  sceneShell.addEventListener('pointerup', onPointerUp)
  sceneShell.addEventListener('pointercancel', onPointerUp)
  sceneShell.addEventListener('wheel', onWheel, { passive: true })
  sceneShell.addEventListener('keydown', onSceneKeydown)
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('scroll', updateScrollUi, { passive: true })

  document.querySelectorAll('[data-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      stopTour()
      setLayout(button.dataset.layout)
    })
  })

  document.querySelector('[data-guided-tour]').addEventListener('click', runGuidedTour)
  document.querySelector('[data-tour-skip]').addEventListener('click', stopTour)
  motionToggle.addEventListener('click', () => setMotionPaused(!state.motionPaused))

  document.querySelectorAll('[data-focus-close]').forEach((element) => element.addEventListener('click', closeFocus))
  document.querySelectorAll('[data-open-node]').forEach((element) => element.addEventListener('click', () => openFocus(element.dataset.openNode)))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && focusPanel.classList.contains('is-open')) closeFocus()
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      openCommand()
    }
  })

  document.querySelectorAll('[data-question]').forEach((button) => button.addEventListener('click', () => updateQuestion(button.dataset.question)))
  document.querySelector('[data-command-open]').addEventListener('click', openCommand)
  commandInput.addEventListener('input', () => renderCommandResults(commandInput.value))
  commandDialog.addEventListener('close', () => {
    commandInput.value = ''
  })

  document.querySelector('[data-film-replay]').addEventListener('click', () => {
    if (!film) return
    film.currentTime = 0
    film.play().catch(() => {})
  })

  reducedMotion.addEventListener?.('change', (event) => setMotionPaused(event.matches))

  const sceneObserver = new IntersectionObserver((entries) => {
    state.visible = entries[0]?.isIntersecting ?? true
  }, { threshold: 0.02 })
  sceneObserver.observe(sceneShell)

  requestAnimationFrame(renderFrame)
})()
