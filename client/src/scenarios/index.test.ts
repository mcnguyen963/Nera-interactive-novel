import { describe, it, expect } from 'vitest'
import { SCENARIOS } from './index'

describe('SCENARIOS', () => {
  it('has 6 scenarios', () => {
    expect(SCENARIOS).toHaveLength(6)
  })

  it('all have required fields', () => {
    for (const s of SCENARIOS) {
      expect(s.id).toBeTruthy()
      expect(s.title).toBeTruthy()
      expect(s.sub).toBeTruthy()
      expect(s.tag).toBeTruthy()
      expect(typeof s.setting).toBe('string')
      expect(typeof s.char).toBe('string')
      expect(typeof s.hook).toBe('string')
      expect(typeof s.player).toBe('string')
    }
  })

  it('has unique ids', () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique titles', () => {
    const titles = SCENARIOS.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('includes custom scenario with default values', () => {
    const custom = SCENARIOS.find((s) => s.id === 'custom')
    expect(custom).toBeDefined()
    expect(custom!.setting).toBeTruthy()
    expect(custom!.char).toBeTruthy()
    expect(custom!.hook).toBeTruthy()
    expect(custom!.player).toBeTruthy()
  })

  it('non-custom scenarios have non-empty setting and player', () => {
    const nonCustom = SCENARIOS.filter((s) => s.id !== 'custom')
    for (const s of nonCustom) {
      expect(s.setting).toBeTruthy()
      expect(s.player).toBeTruthy()
    }
  })

  it('scenarios match known IDs', () => {
    const expected = ['isekai', 'dungeon', 'cyber', 'spirit', 'romance', 'custom']
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(expected.sort())
  })
})
