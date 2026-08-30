import { describe, expect, it } from 'vitest'

import { applySceneIntent, EMPTY_WORLD, parseSceneCommand } from './sceneParser'

describe('scene parser', () => {
  it('parses the flagship mountain laboratory prompt', () => {
    const intent = parseSceneCommand(
      'Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.',
    )

    expect(intent.environment).toBe('mountain-lab')
    expect(intent.timeOfDay).toBe('sunset')
    expect(intent.addObjects.map((object) => object.kind)).toEqual(
      expect.arrayContaining(['robotic-arm', 'microscope', 'sample']),
    )
    expect(intent.agentAction).toBe('inspect')
    expect(intent.agentTarget).toBe('sample')
  })

  it('preserves the world across successive commands', () => {
    const first = applySceneIntent(
      EMPTY_WORLD,
      parseSceneCommand('Create a mountain lab with a microscope and sample.'),
    )
    const second = applySceneIntent(
      first,
      parseSceneCommand('Add a telescope and change the scene to night.'),
    )

    expect(second.objects.map((object) => object.kind)).toEqual(
      expect.arrayContaining(['microscope', 'sample', 'telescope']),
    )
    expect(second.timeOfDay).toBe('night')
    expect(second.commandHistory).toHaveLength(2)
  })

  it('removes named objects without resetting the environment', () => {
    const first = applySceneIntent(
      EMPTY_WORLD,
      parseSceneCommand('Create a forest laboratory with a drone and a microscope.'),
    )
    const second = applySceneIntent(first, parseSceneCommand('Remove the drone.'))

    expect(second.environment).toBe('forest-lab')
    expect(second.objects.some((object) => object.kind === 'drone')).toBe(false)
    expect(second.objects.some((object) => object.kind === 'microscope')).toBe(true)
  })
})
