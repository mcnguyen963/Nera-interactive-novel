import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { get, set } from 'idb-keyval'
import type { LlmSettings, ImageSettings, BackupSettings } from '../types/settings'

interface SettingsState {
  llm: LlmSettings
  image: ImageSettings
  backup: BackupSettings
  setLlm: (partial: Partial<LlmSettings>) => void
  setImage: (partial: Partial<ImageSettings>) => void
  setBackup: (partial: Partial<BackupSettings>) => void
  reset: () => void
}

const defaultLlm: LlmSettings = {
  provider: 'openrouter',
  localUrl: 'http://192.168.8.124:8080',
  localModel: 'local-model',
  openrouterModel: '',
  apiKey: '',
  temperature: 0.9,
  maxTokens: 1500,
  contextWindow: 70000,
  systemPrompt: `You are a literary narrator writing an immersive isekai/fantasy novel. Write in third person past tense, vivid literary prose. Each response should be 2-4 short paragraphs. Do NOT include chapter titles or headers. Do NOT use markdown. Describe actions, sensations and dialogue naturally. When the player acts, write their action INTO the prose first, then continue the scene. Always end with an implicit or explicit hook that invites the reader's next action. Stay in the story world at all times.`,
}

const defaultImage: ImageSettings = {
  provider: 'local',
  localUrl: 'http://localhost:7860',
  cloudApiKey: '',
  model: 'flux',
  corsProxyUrl: '',
  comfyWorkflow: '',
}

const defaultBackup: BackupSettings = {
  cloudTextBackup: false,
  cloudImageBackup: false,
}

const idbStorage = {
  getItem: async (name: string) => {
    const val = await get(name)
    return val !== undefined ? val : null
  },
  setItem: async (name: string, value: unknown): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await set(name, undefined)
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llm: { ...defaultLlm },
      image: { ...defaultImage },
      backup: { ...defaultBackup },
      setLlm: (partial) => set((s) => ({ llm: { ...s.llm, ...partial } })),
      setImage: (partial) => set((s) => ({ image: { ...s.image, ...partial } })),
      setBackup: (partial) => set((s) => ({ backup: { ...s.backup, ...partial } })),
      reset: () => set({ llm: { ...defaultLlm }, image: { ...defaultImage }, backup: { ...defaultBackup } }),
    }),
    {
      name: 'nera-settings',
      storage: idbStorage,
      partialize: (state) => ({
        llm: state.llm,
        image: state.image,
        backup: state.backup,
      }),
    },
  ),
)
