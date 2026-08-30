export type EnvironmentKind = 'mountain' | 'forest' | 'city' | 'ocean' | 'studio'
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night'
export type SceneObjectKind =
  | 'laboratory'
  | 'table'
  | 'robotic-arm'
  | 'microscope'
  | 'sample'
  | 'telescope'
  | 'drone'
  | 'screen'
  | 'lamp'
  | 'chair'
  | 'plant'

export type WorldObject = {
  id: string
  kind: SceneObjectKind
  label: string
  x: number
  y: number
  relation?: string
  selected?: boolean
}

export type AgentAction = {
  verb: 'inspect' | 'move' | 'observe' | 'wait'
  targetId?: string
  status: 'planned' | 'running' | 'complete'
}

export type WorldState = {
  environment: EnvironmentKind
  timeOfDay: TimeOfDay
  mood: 'quiet' | 'active' | 'neutral'
  objects: WorldObject[]
  agent: { x:number; y:number; label:string }
  action?: AgentAction
  history: string[]
  revision: number
}

export type ParsedIntent = {
  raw: string
  operation: 'create' | 'edit' | 'remove'
  environment?: EnvironmentKind
  timeOfDay?: TimeOfDay
  mood?: WorldState['mood']
  additions: Array<{ kind:SceneObjectKind; relation?:string }>
  removals: SceneObjectKind[]
  action?: { verb:AgentAction['verb']; targetKind?:SceneObjectKind }
  confidence: number
  unresolved: string[]
}

export const DEFAULT_WORLD: WorldState = {
  environment: 'studio',
  timeOfDay: 'day',
  mood: 'neutral',
  objects: [],
  agent: { x:76, y:292, label:'agent' },
  history: [],
  revision: 0,
}

const OBJECT_TERMS: Array<[SceneObjectKind, RegExp]> = [
  ['laboratory', /\b(?:laboratory|lab)\b/i],
  ['robotic-arm', /\b(?:robotic arm|robot arm|manipulator)\b/i],
  ['microscope', /\bmicroscope\b/i],
  ['sample', /\b(?:sample|specimen)\b/i],
  ['telescope', /\btelescope\b/i],
  ['drone', /\bdrone\b/i],
  ['screen', /\b(?:screen|display|monitor)\b/i],
  ['lamp', /\b(?:lamp|light)\b/i],
  ['chair', /\bchair\b/i],
  ['plant', /\b(?:plant|tree)\b/i],
  ['table', /\b(?:table|bench|desk)\b/i],
]

const LABELS: Record<SceneObjectKind,string> = {
  laboratory:'mountain laboratory',
  table:'work table',
  'robotic-arm':'robotic arm',
  microscope:'microscope',
  sample:'sample',
  telescope:'telescope',
  drone:'drone',
  screen:'display',
  lamp:'lamp',
  chair:'chair',
  plant:'plant',
}

const POSITIONS: Record<SceneObjectKind,[number,number]> = {
  laboratory:[270,174], table:[274,267], 'robotic-arm':[214,238], microscope:[332,238], sample:[306,263],
  telescope:[400,226], drone:[430,110], screen:[350,184], lamp:[168,235], chair:[395,292], plant:[122,260],
}

function unique<T>(values:T[]):T[] {
  return Array.from(new Set(values))
}

function detectEnvironment(text:string):EnvironmentKind|undefined {
  if (/\b(?:mountain|alpine|peak)\b/i.test(text)) return 'mountain'
  if (/\b(?:forest|woodland|trees)\b/i.test(text)) return 'forest'
  if (/\b(?:city|urban|rooftop)\b/i.test(text)) return 'city'
  if (/\b(?:ocean|sea|coast|beach)\b/i.test(text)) return 'ocean'
  if (/\b(?:studio|room|interior)\b/i.test(text)) return 'studio'
  return undefined
}

function detectTime(text:string):TimeOfDay|undefined {
  if (/\b(?:sunset|golden hour|dusk)\b/i.test(text)) return 'sunset'
  if (/\b(?:night|midnight|stars)\b/i.test(text)) return 'night'
  if (/\b(?:dawn|sunrise|morning)\b/i.test(text)) return 'dawn'
  if (/\b(?:day|daylight|noon)\b/i.test(text)) return 'day'
  return undefined
}

function relationFor(kind:SceneObjectKind,text:string):string|undefined {
  const label=LABELS[kind].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const beside=new RegExp(`${label}[^.]{0,36}(?:beside|next to|near) (?:a |the )?([a-z -]+)`,'i').exec(text)
  if (beside?.[1]) return `beside ${beside[1].trim().split(/,| and /)[0]}`
  const behind=new RegExp(`${label}[^.]{0,36}(?:behind|in front of|above) (?:a |the )?([a-z -]+)`,'i').exec(text)
  return behind?.[1] ? behind[0].trim() : undefined
}

export function parseSceneCommand(raw:string):ParsedIntent {
  const text=raw.trim()
  const removeMode=/\b(?:remove|delete|take away|without)\b/i.test(text)
  const mentioned=OBJECT_TERMS.filter(([,pattern])=>pattern.test(text)).map(([kind])=>kind)
  const removals=removeMode ? unique(mentioned) : []
  const additions=removeMode ? [] : unique(mentioned).map((kind)=>({ kind, relation:relationFor(kind,text) }))
  const targetKind=OBJECT_TERMS.find(([,pattern])=>pattern.test(text))?.[0]
  let action:ParsedIntent['action']
  if (/\binspect\b/i.test(text)) action={ verb:'inspect', targetKind: /sample|specimen/i.test(text)?'sample':targetKind }
  else if (/\b(?:move|walk|go)\b/i.test(text)) action={ verb:'move', targetKind }
  else if (/\b(?:observe|watch)\b/i.test(text)) action={ verb:'observe', targetKind }
  else if (/\bwait\b/i.test(text)) action={ verb:'wait' }

  const recognized=(detectEnvironment(text)?1:0)+(detectTime(text)?1:0)+mentioned.length+(action?1:0)
  return {
    raw:text,
    operation:removeMode?'remove':/\b(?:create|make|build|generate)\b/i.test(text)?'create':'edit',
    environment:detectEnvironment(text),
    timeOfDay:detectTime(text),
    mood:/\b(?:quiet|calm|peaceful)\b/i.test(text)?'quiet':/\b(?:busy|active|lively)\b/i.test(text)?'active':undefined,
    additions,
    removals,
    action,
    confidence:Math.min(.98,.48+recognized*.09),
    unresolved:recognized===0?[text]:[],
  }
}

function nextId(kind:SceneObjectKind,objects:WorldObject[]):string {
  const count=objects.filter((object)=>object.kind===kind).length+1
  return `${kind}-${count}`
}

function targetPosition(kind:SceneObjectKind,objects:WorldObject[]):[number,number] {
  const base=POSITIONS[kind]
  const duplicates=objects.filter((object)=>object.kind===kind).length
  return [base[0]+duplicates*22,base[1]+duplicates*15]
}

export function applySceneIntent(world:WorldState,intent:ParsedIntent):WorldState {
  let objects=world.objects.filter((object)=>!intent.removals.includes(object.kind))
  for (const addition of intent.additions) {
    if (addition.kind==='laboratory' && objects.some((object)=>object.kind==='laboratory')) continue
    const [x,y]=targetPosition(addition.kind,objects)
    objects=[...objects,{ id:nextId(addition.kind,objects),kind:addition.kind,label:LABELS[addition.kind],x,y,relation:addition.relation }]
  }
  let action:AgentAction|undefined
  if (intent.action) {
    const target=intent.action.targetKind ? objects.find((object)=>object.kind===intent.action?.targetKind) : undefined
    action={ verb:intent.action.verb,targetId:target?.id,status:'planned' }
  } else {
    action=world.action
  }
  return {
    ...world,
    environment:intent.environment??world.environment,
    timeOfDay:intent.timeOfDay??world.timeOfDay,
    mood:intent.mood??world.mood,
    objects,
    action,
    history:[...world.history,intent.raw].slice(-12),
    revision:world.revision+1,
  }
}

export function parseAndApply(world:WorldState,command:string):{ intent:ParsedIntent; world:WorldState } {
  const intent=parseSceneCommand(command)
  return { intent,world:applySceneIntent(world,intent) }
}

export function moveWorldObject(world:WorldState,id:string,x:number,y:number):WorldState {
  return { ...world,objects:world.objects.map((object)=>object.id===id?{...object,x,y}:object),revision:world.revision+1 }
}

export function runAgentAction(world:WorldState):WorldState {
  if (!world.action) return world
  const target=world.objects.find((object)=>object.id===world.action?.targetId)
  return {
    ...world,
    agent:target?{...world.agent,x:target.x-26,y:target.y+34}:world.agent,
    action:{...world.action,status:'complete'},
    revision:world.revision+1,
  }
}
