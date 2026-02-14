import { describe, expect, it } from 'vitest'

import { ReplayMemory } from './memory'
import { OnlineCategoryModel, type LabeledTextExample } from './onlineModel'
import { evaluate, regressionDelta } from './regression'

const CATEGORY_A = 'procurement_approvals'
const CATEGORY_B = 'incident_escalation'
const CATEGORY_C = 'monthly_reporting'

describe('online model', () => {
  it('improves on a linearly separable toy text dataset', () => {
    const model = new OnlineCategoryModel(128, [CATEGORY_A, CATEGORY_B, CATEGORY_C], 0.2)
    const trainSet: LabeledTextExample[] = [
      { text: 'procurement purchase approval budget chain', label: CATEGORY_A, risk_level: 'low' },
      { text: 'invoice approval capex procurement owner', label: CATEGORY_A, risk_level: 'low' },
      { text: 'incident escalation on-call severity bridge', label: CATEGORY_B, risk_level: 'high' },
      { text: 'major incident handoff pager escalation', label: CATEGORY_B, risk_level: 'high' },
    ]

    const before = evaluate(trainSet, model)
    model.train(trainSet, { epochs: 35, learningRate: 0.25 })
    const after = evaluate(trainSet, model)

    expect(after.overall_accuracy).toBeGreaterThan(before.overall_accuracy)
    expect(after.overall_accuracy).toBeGreaterThan(0.9)
  })

  it('rehearsal reduces regression in a two-task sequence', () => {
    const task1: LabeledTextExample[] = [
      { text: 'approval procurement budget request', label: CATEGORY_A, risk_level: 'low' },
      { text: 'procurement chain finance approval', label: CATEGORY_A, risk_level: 'low' },
      { text: 'incident escalation severity bridge', label: CATEGORY_B, risk_level: 'high' },
      { text: 'pager alert escalation handoff', label: CATEGORY_B, risk_level: 'high' },
    ]
    const task2: LabeledTextExample[] = [
      { text: 'monthly report spreadsheet compile', label: CATEGORY_C, risk_level: 'medium' },
      { text: 'board pack reporting consolidation', label: CATEGORY_C, risk_level: 'medium' },
      { text: 'kpi reporting data reconciliation', label: CATEGORY_C, risk_level: 'medium' },
    ]

    const initial = new OnlineCategoryModel(128, [CATEGORY_A, CATEGORY_B, CATEGORY_C], 0.2)
    initial.train(task1, { epochs: 35, learningRate: 0.2 })
    const task1Before = evaluate(task1, initial).overall_accuracy

    const naive = initial.clone()
    naive.train(task2, { epochs: 55, learningRate: 0.28 })
    const naiveAfterTask1 = evaluate(task1, naive).overall_accuracy

    const rehearsal = initial.clone()
    const memory = new ReplayMemory(32, 7)
    for (const sample of task1) {
      memory.add({
        id: sample.text,
        text: sample.text,
        label: sample.label,
        risk_level: sample.risk_level ?? 'low',
      })
    }
    const replay = memory.sampleForPreset('balanced', 4)
    rehearsal.train([...task2, ...replay], { epochs: 55, learningRate: 0.28 })
    const rehearsalAfterTask1 = evaluate(task1, rehearsal).overall_accuracy

    expect(task1Before).toBeGreaterThan(0.9)
    expect(rehearsalAfterTask1).toBeGreaterThanOrEqual(naiveAfterTask1)

    const naiveDelta = regressionDelta([
      { step: 'before', metrics: evaluate(task1, initial) },
      { step: 'after', metrics: evaluate(task1, naive) },
    ])
    const rehearsalDelta = regressionDelta([
      { step: 'before', metrics: evaluate(task1, initial) },
      { step: 'after', metrics: evaluate(task1, rehearsal) },
    ])

    expect(rehearsalDelta.mean_drop).toBeLessThanOrEqual(naiveDelta.mean_drop)
  })
})
