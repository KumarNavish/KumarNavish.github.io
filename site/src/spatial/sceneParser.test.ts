import { describe, expect, it } from 'vitest'

import { DEFAULT_WORLD, applySceneIntent, parseAndApply, parseSceneCommand } from './sceneParser'

describe('scene parser', () => {
  it('parses the flagship mountain laboratory prompt', () => {
    const intent = parseSceneCommand(
      'Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.',
    )

    expect(intent.environment).toBe('mountain')
    expect(intent.timeOfDay).toBe('sunset')
    expect(intent.mood).toBe('quiet')
    expect(intent.additions.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['laboratory', 'robotic-arm', 'microscope', 'sample']),
    )
    expect(intent.action).toEqual({ verb: 'inspect', targetKind: 'sample' })
  })

  it('edits persistent state instead of regenerating the world', () => {
    const first = parseAndApply(
      DEFAULT_WORLD,
      'Create a mountain laboratory with a microscope and a sample.',
    )
    const second = parseAndApply(first.world, 'Add a telescope and change the scene to night.')

    expect(second.world.objects.some((item) => item.kind === 'microscope')).toBe(true)
    expect(second.world.objects.some((item) => item.kind === 'telescope')).toBe(true)
    expect(second.world.timeOfDay).toBe('night')
    expect(second.world.history).toHaveLength(2)
  })

  it('supports explicit object removal', () => {
    const created = parseAndApply(DEFAULT_WORLD, 'Create a studio with a lamp and a chair.')
    const removed = applySceneIntent(created.world, parseSceneCommand('Remove the lamp.'))

    expect(removed.objects.some((item) => item.kind === 'chair')).toBe(true)
    expect(removed.objects.some((item) => item.kind === 'lamp')).toBe(false)
  })
})
