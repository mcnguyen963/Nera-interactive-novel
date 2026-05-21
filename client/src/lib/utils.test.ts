import { describe, it, expect } from 'vitest'
import { generateId, timestamp, buildKVContext } from './utils'

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('timestamp', () => {
  it('returns a positive number', () => {
    const ts = timestamp()
    expect(ts).toBeGreaterThan(0)
    expect(Number.isInteger(ts)).toBe(true)
  })

  it('returns recent time (within last second)', () => {
    const before = Date.now()
    const ts = timestamp()
    const after = Date.now()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('buildKVContext', () => {
  const scenario = {
    setting: 'A magical forest',
    companion: 'A talking fox',
    player: 'A lost traveler',
    hook: 'Find the way home',
  }

  it('builds context from scenario and paragraphs', () => {
    const result = buildKVContext(scenario, [{ text: 'You walk through the trees.' }])
    expect(result).toContain('[Story World]')
    expect(result).toContain('A magical forest')
    expect(result).toContain('[Companion/NPC]')
    expect(result).toContain('[Your Role]')
    expect(result).toContain('[Recent Events]')
    expect(result).toContain('You walk through the trees.')
  })

  it('does not include empty scenario fields', () => {
    const result = buildKVContext(
      { setting: '', companion: '', player: '', hook: '' },
      [],
    )
    expect(result).not.toContain('[Story World]')
    expect(result).not.toContain('[Companion/NPC]')
    expect(result).not.toContain('[Your Role]')
    expect(result).not.toContain('[Recent Events]')
  })

  it('truncates recent paragraphs to maxChars', () => {
    const long = 'a'.repeat(500)
    const result = buildKVContext(scenario, [{ text: long }, { text: long }], 200)
    const recentIdx = result.indexOf('[Recent Events]')
    const recentText = result.slice(recentIdx)
    expect(recentText.length).toBeLessThanOrEqual(200 + '[Recent Events]\n'.length)
  })

  it('handles empty paragraph array', () => {
    const result = buildKVContext(scenario, [])
    expect(result).not.toContain('[Recent Events]')
  })

  it('includes scenario fields with whitespace-only values', () => {
    const result = buildKVContext(
      { setting: '  ', companion: 'Real companion', player: '   ', hook: '' },
      [{ text: 'action' }],
    )
    expect(result).not.toContain('[Story World]')
    expect(result).toContain('[Companion/NPC]')
    expect(result).toContain('Real companion')
    expect(result).not.toContain('[Your Role]')
  })
})
