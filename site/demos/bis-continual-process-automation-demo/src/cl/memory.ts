import type { IntakeCategory, RiskLevel } from '../domain/types'
import type { LabeledTextExample } from './onlineModel'

export type ReplayPreset = 'fast_adaptation' | 'balanced' | 'retention_first'

export interface MemoryItem extends LabeledTextExample {
  id: string
  label: IntakeCategory
  risk_level: RiskLevel
  seen_at: number
}

function riskWeight(risk: RiskLevel): number {
  if (risk === 'high') {
    return 4
  }
  if (risk === 'medium') {
    return 2
  }
  return 1
}

class SeededRng {
  private state: number

  constructor(seed = 12345) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0
    return this.state / 0x100000000
  }
}

function sampleWithoutReplacement(
  items: MemoryItem[],
  count: number,
  rng: SeededRng,
): MemoryItem[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}

function weightedSampleWithoutReplacement(
  items: MemoryItem[],
  count: number,
  rng: SeededRng,
): MemoryItem[] {
  const pool = [...items]
  const selected: MemoryItem[] = []

  while (pool.length > 0 && selected.length < count) {
    const totalWeight = pool.reduce((acc, item) => acc + riskWeight(item.risk_level), 0)
    let threshold = rng.next() * totalWeight
    let chosenIndex = 0
    for (let i = 0; i < pool.length; i += 1) {
      threshold -= riskWeight(pool[i].risk_level)
      if (threshold <= 0) {
        chosenIndex = i
        break
      }
    }
    selected.push(pool[chosenIndex])
    pool.splice(chosenIndex, 1)
  }

  return selected
}

export class ReplayMemory {
  private readonly capacity: number
  private readonly rng: SeededRng
  private readonly items: MemoryItem[] = []
  private counter = 0

  constructor(capacity = 128, seed = 42) {
    this.capacity = capacity
    this.rng = new SeededRng(seed)
  }

  add(example: LabeledTextExample & { risk_level: RiskLevel }): void {
    const id = example.id ?? `mem-${this.counter + 1}`
    this.counter += 1
    this.items.push({
      ...example,
      id,
      seen_at: this.counter,
    })
    if (this.items.length > this.capacity) {
      this.items.shift()
    }
  }

  sampleForPreset(preset: ReplayPreset, count = 4): MemoryItem[] {
    if (preset === 'fast_adaptation' || this.items.length === 0 || count <= 0) {
      return []
    }
    if (preset === 'retention_first') {
      return weightedSampleWithoutReplacement(this.items, count, this.rng)
    }
    return sampleWithoutReplacement(this.items, count, this.rng)
  }

  getItems(): MemoryItem[] {
    return [...this.items]
  }
}

export function replayWeightForPreset(
  preset: ReplayPreset,
  example: LabeledTextExample & { risk_level?: RiskLevel },
): number {
  if (preset !== 'retention_first') {
    return 1
  }
  return riskWeight(example.risk_level ?? 'low')
}
