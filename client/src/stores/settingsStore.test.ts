import { describe, it, expect, beforeEach, vi } from 'vitest'

const memMap = new Map<string, unknown>()

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => memMap.get(key)),
  set: vi.fn(async (key: string, val: unknown) => { memMap.set(key, val) }),
}))

import { useSettingsStore } from './settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    memMap.clear()
    useSettingsStore.setState(useSettingsStore.getInitialState())
  })

  describe('initial state', () => {
    it('has default LLM settings', () => {
      const { llm } = useSettingsStore.getState()
      expect(llm.provider).toBe('openrouter')
      expect(llm.temperature).toBe(0.9)
      expect(llm.maxTokens).toBe(1500)
      expect(llm.contextWindow).toBe(70000)
      expect(llm.systemPrompt).toBeTruthy()
    })

    it('has default image settings', () => {
      const { image } = useSettingsStore.getState()
      expect(image.provider).toBe('local')
      expect(image.model).toBe('flux')
    })
  })

  describe('setLlm', () => {
    it('updates partial LLM fields', () => {
      useSettingsStore.getState().setLlm({ temperature: 0.5, maxTokens: 2000 })
      const { llm } = useSettingsStore.getState()
      expect(llm.temperature).toBe(0.5)
      expect(llm.maxTokens).toBe(2000)
      expect(llm.provider).toBe('openrouter')
    })

    it('updates provider', () => {
      useSettingsStore.getState().setLlm({ provider: 'local', localUrl: 'http://localhost:8080' })
      expect(useSettingsStore.getState().llm.provider).toBe('local')
      expect(useSettingsStore.getState().llm.localUrl).toBe('http://localhost:8080')
    })
  })

  describe('setImage', () => {
    it('updates partial image fields', () => {
      useSettingsStore.getState().setImage({ model: 'sdxl', provider: 'cloud' })
      const { image } = useSettingsStore.getState()
      expect(image.model).toBe('sdxl')
      expect(image.provider).toBe('cloud')
    })
  })

  describe('reset', () => {
    it('resets all settings to defaults', () => {
      useSettingsStore.getState().setLlm({ temperature: 0.1, maxTokens: 999 })
      useSettingsStore.getState().setImage({ model: 'sdxl' })
      useSettingsStore.getState().reset()
      const { llm, image } = useSettingsStore.getState()
      expect(llm.temperature).toBe(0.9)
      expect(llm.maxTokens).toBe(1500)
      expect(image.model).toBe('flux')
      expect(image.provider).toBe('local')
    })
  })
})
