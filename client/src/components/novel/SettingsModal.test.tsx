import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const memMap = vi.hoisted(() => new Map<string, unknown>())
const mockFetchModels = vi.hoisted(() => vi.fn())
const mockTestConnection = vi.hoisted(() => vi.fn())

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => memMap.get(key)),
  set: vi.fn(async (key: string, val: unknown) => { memMap.set(key, val) }),
}))

vi.mock('../../lib/edgeApi', () => ({
  fetchModels: mockFetchModels,
  testConnection: mockTestConnection,
}))

// Reactive Zustand-like store mock
const mockLlmState = vi.hoisted(() => ({
  value: {
    provider: 'openrouter',
    localUrl: 'http://192.168.8.124:8080',
    localModel: 'local-model',
    openrouterModel: '',
    customUrl: '',
    customApiKey: '',
    apiKey: '',
    temperature: 0.9,
    maxTokens: 1500,
    contextWindow: 70000,
    systemPrompt: 'default prompt',
  },
}))

const mockImageState = vi.hoisted(() => ({
  value: {
    provider: 'local' as string,
    localUrl: 'http://localhost:7860',
    cloudApiKey: '',
    model: 'flux',
    corsProxyUrl: '',
    comfyWorkflow: '',
  },
}))

const mockBackupState = vi.hoisted(() => ({
  value: {
    cloudTextBackup: false,
    cloudImageBackup: false,
  },
}))

// Shared mutable container for mock state and subscribers
const mockStoreState = vi.hoisted(() => ({
  llm: mockLlmState.value,
  image: mockImageState.value,
  backup: mockBackupState.value,
  llmSubscribers: [] as Array<() => void>,
  imageSubscribers: [] as Array<() => void>,
  backupSubscribers: [] as Array<() => void>,
}))

// Mock functions defined with vi.hoisted so they're accessible in both mock factory and test code
const mockSetLlmFn = vi.fn((partial: Partial<typeof mockStoreState.llm>) => {
  Object.assign(mockStoreState.llm, partial)
  mockStoreState.llmSubscribers.forEach((cb) => cb())
})
const mockSetImageFn = vi.fn((partial: Partial<typeof mockStoreState.image>) => {
  Object.assign(mockStoreState.image, partial)
  mockStoreState.imageSubscribers.forEach((cb) => cb())
})
const mockSetBackupFn = vi.fn((partial: Partial<typeof mockStoreState.backup>) => {
  Object.assign(mockStoreState.backup, partial)
  mockStoreState.backupSubscribers.forEach((cb) => cb())
})
const mockCloseSettingsFn = vi.fn()

vi.mock('../../stores', () => {
  const s = mockStoreState
  const useSettingsStore = vi.fn(() => ({
    llm: s.llm,
    image: s.image,
    backup: s.backup,
    setLlm: mockSetLlmFn,
    setImage: mockSetImageFn,
    setBackup: mockSetBackupFn,
    reset: vi.fn(),
  }))
  ;(useSettingsStore as any).subscribe = (cb: () => void) => {
    s.llmSubscribers.push(cb)
    return () => { const i = s.llmSubscribers.indexOf(cb); if (i >= 0) s.llmSubscribers.splice(i, 1) }
  }

  return {
    useSettingsStore,
    useUiStore: vi.fn(() => ({
      showSettings: true,
      closeSettings: mockCloseSettingsFn,
      toasts: [],
      addToast: vi.fn(),
      removeToast: vi.fn(),
      showImageModal: false,
      openImageModal: vi.fn(),
      closeImageModal: vi.fn(),
      imageModalTitle: '',
      imageModalPrompt: '',
      imageModalUrl: null,
      imageModalTargetChapterIndex: 0,
      imageModalTargetParagraphIndex: null,
      isGeneratingImage: false,
      setGeneratingImage: vi.fn(),
      setImageModalUrl: vi.fn(),
      setImageModalPrompt: vi.fn(),
    })),
  }
})

vi.mock('../../lib/utils', () => ({
  generateId: vi.fn(() => 'test-id'),
  timestamp: vi.fn(() => Date.now()),
}))

import { SettingsModal } from './SettingsModal'

// Helper: find input by label text - label and input are siblings within a wrapper div
function getInputByLabel(container: HTMLElement, labelText: string): HTMLElement {
  const labelEl = Array.from(container.querySelectorAll('label')).find(
    (l) => (l.textContent || '').includes(labelText),
  )
  if (!labelEl) {
    const allLabels = Array.from(container.querySelectorAll('label')).map((l) => l.textContent?.trim())
    throw new Error(`Label containing "${labelText}" not found. Available: ${allLabels.join(', ')}`)
  }
  // Find the parent wrapper div, then find the input within it
  const parent = labelEl.parentElement
  if (parent) {
    const input = parent.querySelector('input, select, textarea')
    if (input) return input as HTMLElement
  }
  // Fallback: search the next sibling element
  let next = labelEl.nextElementSibling
  while (next) {
    if (next.tagName === 'INPUT' || next.tagName === 'SELECT' || next.tagName === 'TEXTAREA') {
      return next as HTMLElement
    }
    next = next.nextElementSibling
  }
  throw new Error(`No input found near label "${labelText}"`)
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memMap.clear()
    // Reset reactive state
    Object.assign(mockLlmState.value, {
      provider: 'openrouter',
      localUrl: 'http://192.168.8.124:8080',
      localModel: 'local-model',
      openrouterModel: '',
      customUrl: '',
      customApiKey: '',
      apiKey: '',
      temperature: 0.9,
      maxTokens: 1500,
      contextWindow: 70000,
      systemPrompt: 'default prompt',
    })
    Object.assign(mockImageState.value, {
    provider: 'local' as string,
      localUrl: 'http://localhost:7860',
      cloudApiKey: '',
      model: 'flux',
      corsProxyUrl: '',
      comfyWorkflow: '',
    })
    Object.assign(mockBackupState.value, {
      cloudTextBackup: false,
      cloudImageBackup: false,
    })
  })

  function setStoreState(overrides?: { llm?: Partial<typeof mockLlmState.value>; image?: Partial<typeof mockImageState.value>; backup?: Partial<typeof mockBackupState.value> }) {
    if (overrides?.llm) Object.assign(mockLlmState.value, overrides.llm)
    if (overrides?.image) Object.assign(mockImageState.value, overrides.image)
    if (overrides?.backup) Object.assign(mockBackupState.value, overrides.backup)
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // UNIT TESTS - handleFetchModels
  // =========================================================================

  describe('handleFetchModels', () => {
    it('filters out embed models and sorts alphabetically', async () => {
      mockFetchModels.mockResolvedValue([
        { id: 'z-model' },
        { id: 'gpt-4o-embed' },
        { id: 'ada-embed' },
        { id: 'babbage' },
        { id: 'gpt-4' },
      ])

      const { container } = render(<SettingsModal />)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshBtn)

      await waitFor(() => {
        expect(mockFetchModels).toHaveBeenCalledWith('')
      })

      const comboboxes = container.querySelectorAll('select')
      const modelSelect = comboboxes[1] as HTMLSelectElement
      const options = modelSelect.querySelectorAll('option')
      const optionValues = Array.from(options).slice(1).map((o) => o.value)
      expect(optionValues).toEqual(['babbage', 'gpt-4', 'z-model'])
    })

    it('handles empty response', async () => {
      mockFetchModels.mockResolvedValue([])

      const { container } = render(<SettingsModal />)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshBtn)

      await waitFor(() => {
        expect(mockFetchModels).toHaveBeenCalled()
      })

      const comboboxes = container.querySelectorAll('select')
      const modelSelect = comboboxes[1] as HTMLSelectElement
      const options = modelSelect.querySelectorAll('option')
      expect(options).toHaveLength(1)
    })

    it('handles fetch error by clearing models', async () => {
      mockFetchModels.mockRejectedValue(new Error('Network error'))

      const { container } = render(<SettingsModal />)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshBtn)

      await waitFor(() => {
        expect(mockFetchModels).toHaveBeenCalled()
      })

      const comboboxes = container.querySelectorAll('select')
      const modelSelect = comboboxes[1] as HTMLSelectElement
      const options = modelSelect.querySelectorAll('option')
      expect(options).toHaveLength(1)
    })

    it('disables refresh button while loading', async () => {
      mockFetchModels.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
      )

      render(<SettingsModal />)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      expect(refreshBtn.hasAttribute('disabled')).toBe(false)

      fireEvent.click(refreshBtn)
      expect(refreshBtn.hasAttribute('disabled')).toBe(true)

      await waitFor(() => {
        expect(refreshBtn.hasAttribute('disabled')).toBe(false)
      })
    })
  })

  // =========================================================================
  // UNIT TESTS - handleTestConnection
  // =========================================================================

  describe('handleTestConnection', () => {
    it('calls testConnection with correct URL and key', async () => {
      mockTestConnection.mockResolvedValue(true)

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalled()
      })
    })

    it('shows Connected button text on success', async () => {
      mockTestConnection.mockResolvedValue(true)

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(btn.textContent).toContain('Connected')
      })
    })

    it('shows Failed button text on failure', async () => {
      mockTestConnection.mockResolvedValue(false)

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(btn.textContent).toBe('Failed')
      })
    })

    it('uses openrouter URL when provider is openrouter', async () => {
      setStoreState({ llm: { apiKey: 'sk-test', provider: 'openrouter' } })
      mockTestConnection.mockResolvedValue(true)

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledWith(
          'https://openrouter.ai/api/v1/models',
          'sk-test',
        )
      })
    })

    it('uses localUrl when provider is local', async () => {
      setStoreState({ llm: { provider: 'local', localUrl: 'http://localhost:8080' } })
      mockTestConnection.mockResolvedValue(true)

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledWith('http://localhost:8080', '')
      })
    })
  })

  // =========================================================================
  // UNIT TESTS - Provider-specific fields
  // =========================================================================

  describe('provider-specific fields', () => {
    it('shows URL and model inputs for local provider', () => {
      setStoreState({ llm: { provider: 'local', localUrl: 'http://localhost:8080', localModel: 'my-model' } })

      const { container } = render(<SettingsModal />)

      const apiUrlInput = getInputByLabel(container, 'API URL')
      expect(apiUrlInput.tagName).toBe('INPUT')

      const modelInput = getInputByLabel(container, 'Model')
      expect(modelInput.tagName).toBe('INPUT')
    })

    it('shows model select and API key for openrouter provider', () => {
      const { container } = render(<SettingsModal />)

      const comboboxes = container.querySelectorAll('select')
      expect(comboboxes.length).toBeGreaterThanOrEqual(2)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      expect(refreshBtn).toBeDefined()

      const apiKeyInput = getInputByLabel(container, 'API Key')
      expect(apiKeyInput.tagName).toBe('INPUT')
      expect((apiKeyInput as HTMLInputElement).type).toBe('password')
    })

    it('shows all fields for custom provider', () => {
      setStoreState({ llm: { provider: 'custom', customUrl: 'https://api.example.com/v1', customApiKey: 'sk-custom' } })

      const { container } = render(<SettingsModal />)

      const baseUrlInput = getInputByLabel(container, 'API Base URL')
      expect(baseUrlInput.tagName).toBe('INPUT')

      const apiKeyInput = getInputByLabel(container, 'API Key')
      expect(apiKeyInput.tagName).toBe('INPUT')
      expect((apiKeyInput as HTMLInputElement).type).toBe('password')

      const modelInput = getInputByLabel(container, 'Model')
      expect(modelInput.tagName).toBe('INPUT')
    })

    it('hides provider-specific fields when switching providers', () => {
      const { container } = render(<SettingsModal />)

      const comboboxes = container.querySelectorAll('select')
      const providerSelect = comboboxes[0] as HTMLSelectElement
      expect(providerSelect.value).toBe('openrouter')

      fireEvent.change(providerSelect, { target: { value: 'local' } })

      const apiUrlInput = getInputByLabel(container, 'API URL')
      expect(apiUrlInput.tagName).toBe('INPUT')
    })
  })

  // =========================================================================
  // UNIT TESTS - Temperature slider
  // =========================================================================

  describe('temperature slider', () => {
    it('displays current temperature value', () => {
      render(<SettingsModal />)
      const el = screen.getByText(/Temperature: 0\.90/)
      expect(el).toBeDefined()
    })

    it('updates temperature on slider change', () => {
      const { container } = render(<SettingsModal />)
      const slider = getInputByLabel(container, 'Temperature') as HTMLInputElement
      fireEvent.change(slider, { target: { value: '0.5' } })
      expect(mockSetLlmFn).toHaveBeenCalledWith({ temperature: 0.5 })
    })

    it('updates temperature display after change', () => {
      const { container } = render(<SettingsModal />)
      const slider = getInputByLabel(container, 'Temperature') as HTMLInputElement
      fireEvent.change(slider, { target: { value: '1.5' } })
      expect(mockSetLlmFn).toHaveBeenCalledWith({ temperature: 1.5 })
    })

    it('respects min and max range', () => {
      const { container } = render(<SettingsModal />)
      const slider = getInputByLabel(container, 'Temperature') as HTMLInputElement
      expect(slider.getAttribute('min')).toBe('0')
      expect(slider.getAttribute('max')).toBe('2')
      expect(slider.getAttribute('step')).toBe('0.05')
    })
  })

  // =========================================================================
  // UNIT TESTS - Max tokens input
  // =========================================================================

  describe('max tokens input', () => {
    it('displays current max tokens value', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Max tokens') as HTMLInputElement
      expect((input as HTMLInputElement).value).toBe('1500')
    })

    it('updates max tokens on input change', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Max tokens') as HTMLInputElement
      fireEvent.change(input, { target: { value: '2048' } })
      expect(mockSetLlmFn).toHaveBeenCalledWith({ maxTokens: 2048 })
    })

    it('falls back to 1500 for empty input', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Max tokens') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      expect(mockSetLlmFn).toHaveBeenCalledWith({ maxTokens: 1500 })
    })

    it('has min and max attributes', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Max tokens') as HTMLInputElement
      expect(input.getAttribute('min')).toBe('64')
      expect(input.getAttribute('max')).toBe('4096')
    })
  })

  // =========================================================================
  // UNIT TESTS - Context window input
  // =========================================================================

  describe('context window input', () => {
    it('displays current context window value', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Context window') as HTMLInputElement
      expect((input as HTMLInputElement).value).toBe('70000')
    })

    it('updates context window on input change', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Context window') as HTMLInputElement
      fireEvent.change(input, { target: { value: '32000' } })
      expect(mockSetLlmFn).toHaveBeenCalledWith({ contextWindow: 32000 })
    })

    it('has min and max attributes', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Context window') as HTMLInputElement
      expect(input.getAttribute('min')).toBe('1000')
      expect(input.getAttribute('max')).toBe('100000')
    })
  })

  // =========================================================================
  // UNIT TESTS - System prompt textarea
  // =========================================================================

  describe('system prompt textarea', () => {
    it('displays current system prompt', () => {
      const { container } = render(<SettingsModal />)
      const textarea = getInputByLabel(container, 'System prompt') as HTMLTextAreaElement
      expect((textarea as HTMLTextAreaElement).value).toBe('default prompt')
    })

    it('updates system prompt on change', () => {
      const { container } = render(<SettingsModal />)
      const textarea = getInputByLabel(container, 'System prompt') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'new prompt' } })
      expect(mockSetLlmFn).toHaveBeenCalledWith({ systemPrompt: 'new prompt' })
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Fetching models and selecting
  // =========================================================================

  describe('integration - fetching models', () => {
    it('fetching models and selecting one updates settings store', async () => {
      mockFetchModels.mockResolvedValue([
        { id: 'gpt-4' },
        { id: 'claude-3' },
      ])

      const { container } = render(<SettingsModal />)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshBtn)

      await waitFor(() => {
        expect(mockFetchModels).toHaveBeenCalled()
      })

      const comboboxes = container.querySelectorAll('select')
      const modelSelect = comboboxes[1] as HTMLSelectElement
      fireEvent.change(modelSelect, { target: { value: 'claude-3' } })

      expect(mockSetLlmFn).toHaveBeenCalledWith({ openrouterModel: 'claude-3' })
    })

    it('selecting a model shows free indicator', async () => {
      mockFetchModels.mockResolvedValue([
        { id: 'free-model', pricing: { prompt: '0' } },
        { id: 'paid-model', pricing: { prompt: '0.001' } },
      ])

      render(<SettingsModal />)

      const refreshBtn = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshBtn)

      await waitFor(() => {
        expect(screen.getByText('free-model (free)')).toBeDefined()
      })
      expect(screen.getByText('paid-model')).toBeDefined()
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Testing connection flow
  // =========================================================================

  describe('integration - testing connection', () => {
    it('shows loading state while testing', async () => {
      mockTestConnection.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 10)),
      )

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(btn.textContent).toContain('Testing')
      })
    })

    it('transitions from testing to connected', async () => {
      mockTestConnection.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 10)),
      )

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(btn.textContent).toContain('Connected')
      })
    })

    it('transitions from testing to failed', async () => {
      mockTestConnection.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(false), 10)),
      )

      render(<SettingsModal />)

      const btn = screen.getByRole('button', { name: /test connection/i })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(btn.textContent).toBe('Failed')
      })
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Saving settings
  // =========================================================================

  describe('integration - saving settings', () => {
    it('closeSettings is called when Save button is clicked', async () => {
      render(<SettingsModal />)

      const saveBtn = screen.getByRole('button', { name: /save & close/i })
      fireEvent.click(saveBtn)

      expect(mockCloseSettingsFn).toHaveBeenCalled()
    })

    it('changing provider and saving reflects in store', async () => {
      const { container } = render(<SettingsModal />)

      const comboboxes = container.querySelectorAll('select')
      const providerSelect = comboboxes[0] as HTMLSelectElement
      fireEvent.change(providerSelect, { target: { value: 'local' } })

      expect(mockSetLlmFn).toHaveBeenCalledWith({ provider: 'local' })
    })
  })

  // =========================================================================
  // SYSTEM/COMPONENT TESTS - Modal open and close
  // =========================================================================

  describe('system - modal open and close', () => {
    it('renders modal content when showSettings is true', () => {
      render(<SettingsModal />)
      expect(screen.getByText('Server & Generation Settings')).toBeDefined()
    })

    it('closes modal when Save & close button is clicked', async () => {
      render(<SettingsModal />)
      const saveBtn = screen.getByRole('button', { name: /save & close/i })
      fireEvent.click(saveBtn)
      expect(mockCloseSettingsFn).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // SYSTEM/COMPONENT TESTS - All provider options render
  // =========================================================================

  describe('system - provider options', () => {
    it('renders all three provider options', () => {
      const { container } = render(<SettingsModal />)
      const comboboxes = container.querySelectorAll('select')
      const providerSelect = comboboxes[0] as HTMLSelectElement
      const options = providerSelect.querySelectorAll('option')
      const optionTexts = Array.from(options).map((o) => o.textContent)
      expect(optionTexts).toContain('Local (llama.cpp compatible)')
      expect(optionTexts).toContain('Cloud (OpenRouter)')
      expect(optionTexts).toContain('Custom (OpenAI-compatible API)')
    })

    it('switches to local provider and shows local fields', () => {
      setStoreState({ llm: { provider: 'local' } })
      const { container } = render(<SettingsModal />)
      const apiUrlInput = getInputByLabel(container, 'API URL')
      expect(apiUrlInput.tagName).toBe('INPUT')
    })

    it('switches to openrouter provider and shows openrouter fields', () => {
      setStoreState({ llm: { provider: 'openrouter' } })
      const { container } = render(<SettingsModal />)
      expect(screen.getByRole('button', { name: /refresh/i })).toBeDefined()
      const apiKeyInput = getInputByLabel(container, 'API Key')
      expect(apiKeyInput.tagName).toBe('INPUT')
      expect((apiKeyInput as HTMLInputElement).type).toBe('password')
    })

    it('switches to custom provider and shows custom fields', () => {
      setStoreState({ llm: { provider: 'custom' } })
      const { container } = render(<SettingsModal />)
      const baseUrlInput = getInputByLabel(container, 'API Base URL')
      expect(baseUrlInput.tagName).toBe('INPUT')
      const apiKeyInput = getInputByLabel(container, 'API Key')
      expect(apiKeyInput.tagName).toBe('INPUT')
      expect((apiKeyInput as HTMLInputElement).type).toBe('password')
    })
  })

  // =========================================================================
  // SYSTEM/COMPONENT TESTS - LLM settings section
  // =========================================================================

  describe('system - LLM settings section', () => {
    it('renders Generation section header', () => {
      render(<SettingsModal />)
      expect(screen.getByText('Generation')).toBeDefined()
    })

    it('renders temperature slider', () => {
      const { container } = render(<SettingsModal />)
      const slider = getInputByLabel(container, 'Temperature')
      expect(slider.tagName).toBe('INPUT')
      expect((slider as HTMLInputElement).type).toBe('range')
    })

    it('renders max tokens input', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Max tokens')
      expect(input.tagName).toBe('INPUT')
    })

    it('renders context window input', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Context window')
      expect(input.tagName).toBe('INPUT')
    })

    it('renders system prompt textarea', () => {
      const { container } = render(<SettingsModal />)
      const textarea = getInputByLabel(container, 'System prompt')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('renders Test connection button', () => {
      render(<SettingsModal />)
      expect(screen.getByRole('button', { name: /test connection/i })).toBeDefined()
    })

    it('renders Save & close button', () => {
      render(<SettingsModal />)
      expect(screen.getByRole('button', { name: /save & close/i })).toBeDefined()
    })
  })

  // =========================================================================
  // SYSTEM/COMPONENT TESTS - Image generation settings section
  // =========================================================================

  describe('system - image generation settings section', () => {
    it('renders Image Generation section header', () => {
      render(<SettingsModal />)
      expect(screen.getByText('Image Generation')).toBeDefined()
    })

    it('renders image provider select', () => {
      const { container } = render(<SettingsModal />)
      const comboboxes = container.querySelectorAll('select')
      expect(comboboxes.length).toBeGreaterThanOrEqual(2)
      const imageProviderSelect = comboboxes[1] as HTMLSelectElement
      expect(imageProviderSelect).toBeDefined()
    })

    it('renders image model input', () => {
      render(<SettingsModal />)
      const input = screen.getByPlaceholderText(/flux|stable-diffusion|dall-e/i)
      expect(input).toBeDefined()
    })

    it('renders CORS Proxy URL input', () => {
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'CORS Proxy')
      expect(input.tagName).toBe('INPUT')
    })

    it('renders ComfyUI Workflow textarea', () => {
      const { container } = render(<SettingsModal />)
      const textarea = getInputByLabel(container, 'ComfyUI Workflow')
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('shows local image URL field when provider is local', () => {
      setStoreState({ image: { provider: 'local' } })
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Image API URL')
      expect(input.tagName).toBe('INPUT')
    })

    it('shows cloud image API key field when provider is cloud', () => {
      setStoreState({ image: { provider: 'cloud' } })
      const { container } = render(<SettingsModal />)
      const input = getInputByLabel(container, 'Image API Key')
      expect(input.tagName).toBe('INPUT')
      expect((input as HTMLInputElement).type).toBe('password')
    })
  })

  // =========================================================================
  // SYSTEM/COMPONENT TESTS - Backup toggle
  // =========================================================================

  describe('system - backup toggle', () => {
    it('renders Cloud Backup section header', () => {
      render(<SettingsModal />)
      expect(screen.getByText('Cloud Backup')).toBeDefined()
    })

    it('renders cloud text backup toggle', () => {
      render(<SettingsModal />)
      expect(screen.getByText(/back up novel text to cloud/i)).toBeDefined()
    })

    it('renders cloud image backup toggle', () => {
      render(<SettingsModal />)
      expect(screen.getByText(/back up images to cloud/i)).toBeDefined()
    })

    it('toggles cloud text backup on change', async () => {
      render(<SettingsModal />)
      const user = userEvent.setup()
      const textCheckbox = screen.getByRole('checkbox', { name: /back up novel text/i })
      await user.click(textCheckbox)
      expect(mockSetBackupFn).toHaveBeenCalledWith({ cloudTextBackup: true })
    })

    it('toggles cloud image backup on change', async () => {
      render(<SettingsModal />)
      const user = userEvent.setup()
      const imageCheckbox = screen.getByRole('checkbox', { name: /back up images/i })
      await user.click(imageCheckbox)
      expect(mockSetBackupFn).toHaveBeenCalledWith({ cloudImageBackup: true })
    })
  })
})
