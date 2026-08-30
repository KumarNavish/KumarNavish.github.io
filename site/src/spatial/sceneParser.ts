export type EnvironmentKind = 'empty' | 'mountain-lab' | 'forest-lab' | 'city-studio' | 'ocean-station'
export type TimeOfDay = 'day' | 'sunset' | 'night' | 'dawn'

export type SceneObjectKind =
  | 'robotic-arm'
  | 'microscope'
  | 'sample'
  | 'lab-table'
  | 'telescope'
  | 'drone'
  | 'lamp'
  | 'screen'
  | 'chair'
  | 'plant'

export interface SceneRelation {
  type: 'beside' | 'on' | 'near'
  targetKind: SceneObjectKind
}

export interface SceneObject {
  id: string
  kind: SceneObjectKind
  label: string
  x: number
  y: number
  relation?: SceneRelation
}

export interface SceneAgent {
  id: string
  label: string
  action: 'idle' | 'inspect' | 'carry' | 'scan' | 'observe'
  targetKind?: SceneObjectKind
  x: number
  y: number
}

export interface SceneIntent {
  raw: string
  environment?: EnvironmentKind
  timeOfDay?: TimeOfDay
  addObjects: Array<{
    kind: SceneObjectKind
    relation?: SceneRelation
  }>
  removeKinds: SceneObjectKind[]
  agentAction?: SceneAgent['action']
  agentTarget?: SceneObjectKind
  concepts: string[]
}

export interface WorldState {
  environment: EnvironmentKind
  timeOfDay: TimeOfDay
  objects: SceneObject[]
  agents: SceneAgent[]
  commandHistory: string[]
  revision: number
}

const OBJECT_LABELS: Record<SceneObjectKind, string> = {
  'robotic-arm': 'Robotic arm',
  microscope: 'Microscope',
  sample: 'Sample',
  'lab-table': 'Lab table',
  telescope: 'Telescope',
  drone: 'Drone',
  lamp: 'Lamp',
  screen: 'Research screen',
  chair: 'Chair',
  plant: 'Plant',
}

const OBJECT_PATTERNS: Array<{ kind: SceneObjectKind; patterns: string[] }> = [
  { kind: 'robotic-arm', patterns: ['robotic arm', 'robot arm', 'manipulator'] },
  { kind: 'microscope', patterns: ['microscope'] },
  { kind: 'sample', patterns: ['sample', 'specimen', 'petri dish'] },
  { kind: 'lab-table', patterns: ['lab table', 'workbench', 'bench', 'table'] },
  { kind: 'telescope', patterns: ['telescope'] },
  { kind: 'drone', patterns: ['drone', 'quadrotor'] },
  { kind: 'lamp', patterns: ['lamp', 'light'] },
  { kind: 'screen', patterns: ['screen', 'display', 'monitor'] },
  { kind: 'chair', patterns: ['chair', 'stool'] },
  { kind: 'plant', patterns: ['plant', 'tree'] },
]

const DEFAULT_POSITIONS: Record<SceneObjectKind, { x: number; y: number }> = {
  'lab-table': { x: 398, y: 334 },
  microscope: { x: 452, y: 278 },
  'robotic-arm': { x: 330, y: 278 },
  sample: { x: 420, y: 300 },
  telescope: { x: 650, y: 270 },
  drone: { x: 584, y: 135 },
  lamp: { x: 248, y: 250 },
  screen: { x: 535, y: 242 },
  chair: { x: 270, y: 356 },
  plant: { x: 700, y: 348 },
}

export const EMPTY_WORLD: WorldState = {
  environment: 'empty',
  timeOfDay: 'day',
  objects: [],
  agents: [],
  commandHistory: [],
  revision: 0,
}

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern))
}

function findObjectKind(value: string): SceneObjectKind | undefined {
  return OBJECT_PATTERNS.find((item) => containsAny(value, item.patterns))?.kind
}

function inferRelation(input: string, objectKind: SceneObjectKind): SceneRelation | undefined {
  const relationPatterns: Array<{ token: string; type: SceneRelation['type'] }> = [
    { token: 'beside', type: 'beside' },
    { token: 'next to', type: 'beside' },
    { token: 'near', type: 'near' },
    { token: 'on ', type: 'on' },
  ]

  const objectLabel = OBJECT_LABELS[objectKind].toLowerCase()
  const objectIndex = input.indexOf(objectLabel)
  if (objectIndex < 0) return undefined

  const localWindow = input.slice(Math.max(0, objectIndex - 70), Math.min(input.length, objectIndex + 90))
  const relation = relationPatterns.find((candidate) => localWindow.includes(candidate.token))
  if (!relation) return undefined

  const otherKind = OBJECT_PATTERNS.find(
    (item) => item.kind !== objectKind && containsAny(localWindow, item.patterns),
  )?.kind
  if (!otherKind) return undefined

  return { type: relation.type, targetKind: otherKind }
}

export function parseSceneCommand(command: string): SceneIntent {
  const input = command.trim().toLowerCase()
  const intent: SceneIntent = {
    raw: command.trim(),
    addObjects: [],
    removeKinds: [],
    concepts: [],
  }

  if (containsAny(input, ['mountain', 'alpine', 'peak'])) {
    intent.environment = 'mountain-lab'
    intent.concepts.push('mountain environment')
  } else if (containsAny(input, ['forest', 'woodland'])) {
    intent.environment = 'forest-lab'
    intent.concepts.push('forest environment')
  } else if (containsAny(input, ['city', 'urban', 'rooftop'])) {
    intent.environment = 'city-studio'
    intent.concepts.push('urban environment')
  } else if (containsAny(input, ['ocean', 'sea', 'coastal', 'underwater'])) {
    intent.environment = 'ocean-station'
    intent.concepts.push('ocean environment')
  } else if (containsAny(input, ['laboratory', 'lab', 'studio'])) {
    intent.environment = 'mountain-lab'
    intent.concepts.push('laboratory environment')
  }

  if (containsAny(input, ['sunset', 'golden hour', 'evening'])) {
    intent.timeOfDay = 'sunset'
    intent.concepts.push('sunset lighting')
  } else if (containsAny(input, ['night', 'moonlight', 'dark'])) {
    intent.timeOfDay = 'night'
    intent.concepts.push('night lighting')
  } else if (containsAny(input, ['dawn', 'sunrise', 'morning'])) {
    intent.timeOfDay = 'dawn'
    intent.concepts.push('dawn lighting')
  } else if (containsAny(input, ['daylight', 'daytime', 'bright'])) {
    intent.timeOfDay = 'day'
    intent.concepts.push('day lighting')
  }

  const removing = containsAny(input, ['remove', 'delete', 'take away', 'without'])
  for (const objectPattern of OBJECT_PATTERNS) {
    if (!containsAny(input, objectPattern.patterns)) continue
    if (removing) {
      intent.removeKinds.push(objectPattern.kind)
      intent.concepts.push(`remove ${OBJECT_LABELS[objectPattern.kind].toLowerCase()}`)
    } else {
      intent.addObjects.push({
        kind: objectPattern.kind,
        relation: inferRelation(input, objectPattern.kind),
      })
      intent.concepts.push(`add ${OBJECT_LABELS[objectPattern.kind].toLowerCase()}`)
    }
  }

  if (containsAny(input, ['inspect', 'examine'])) {
    intent.agentAction = 'inspect'
  } else if (containsAny(input, ['carry', 'move the sample', 'transport'])) {
    intent.agentAction = 'carry'
  } else if (containsAny(input, ['scan', 'measure'])) {
    intent.agentAction = 'scan'
  } else if (containsAny(input, ['observe', 'watch'])) {
    intent.agentAction = 'observe'
  }

  if (intent.agentAction) {
    const actionIndex = input.indexOf(intent.agentAction === 'inspect' ? 'inspect' : intent.agentAction)
    const actionWindow = input.slice(Math.max(0, actionIndex), Math.min(input.length, actionIndex + 90))
    intent.agentTarget = findObjectKind(actionWindow) ?? findObjectKind(input)
    intent.concepts.push(`agent ${intent.agentAction}${intent.agentTarget ? ` ${OBJECT_LABELS[intent.agentTarget].toLowerCase()}` : ''}`)
  }

  return intent
}

function positionForKind(
  kind: SceneObjectKind,
  existingObjects: SceneObject[],
  relation?: SceneRelation,
): { x: number; y: number } {
  const base = DEFAULT_POSITIONS[kind]
  if (!relation) {
    const duplicates = existingObjects.filter((object) => object.kind === kind).length
    return { x: base.x + duplicates * 28, y: base.y + duplicates * 14 }
  }

  const target = existingObjects.find((object) => object.kind === relation.targetKind)
  if (!target) return base

  if (relation.type === 'on') return { x: target.x + 22, y: target.y - 46 }
  if (relation.type === 'beside') return { x: target.x + 92, y: target.y }
  return { x: target.x + 64, y: target.y - 18 }
}

export function applySceneIntent(world: WorldState, intent: SceneIntent): WorldState {
  let objects = world.objects.filter((object) => !intent.removeKinds.includes(object.kind))

  for (const requested of intent.addObjects) {
    const alreadyExists = objects.some((object) => object.kind === requested.kind)
    if (alreadyExists && !requested.relation) continue
    const position = positionForKind(requested.kind, objects, requested.relation)
    objects = [
      ...objects,
      {
        id: `${requested.kind}-${world.revision + 1}-${objects.length}`,
        kind: requested.kind,
        label: OBJECT_LABELS[requested.kind],
        x: position.x,
        y: position.y,
        relation: requested.relation,
      },
    ]
  }

  let agents = world.agents
  if (intent.agentAction) {
    const target = intent.agentTarget
      ? objects.find((object) => object.kind === intent.agentTarget)
      : objects[0]
    agents = [
      {
        id: 'scene-agent',
        label: 'Situated agent',
        action: intent.agentAction,
        targetKind: intent.agentTarget,
        x: target ? Math.max(90, target.x - 118) : 220,
        y: target ? target.y + 16 : 340,
      },
    ]
  }

  return {
    environment: intent.environment ?? world.environment,
    timeOfDay: intent.timeOfDay ?? world.timeOfDay,
    objects,
    agents,
    commandHistory: intent.raw ? [...world.commandHistory, intent.raw] : world.commandHistory,
    revision: world.revision + 1,
  }
}

export function moveSceneObject(world: WorldState, id: string, x: number, y: number): WorldState {
  return {
    ...world,
    objects: world.objects.map((object) =>
      object.id === id
        ? { ...object, x: Math.max(42, Math.min(778, x)), y: Math.max(92, Math.min(440, y)) }
        : object,
    ),
    revision: world.revision + 1,
  }
}
