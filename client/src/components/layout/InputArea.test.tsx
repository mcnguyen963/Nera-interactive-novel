import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const storeState = vi.hoisted(() => ({
  story: null as any,
  chapters: [] as any[],
  activeChapterIndex: 0,
  isGenerating: false,
  addParagraphFn: vi.fn(),
  updateParagraphFn: vi.fn(),
  setGeneratingFn: vi.fn(),
  llm: {
    provider: 'openrouter' as const,
    openrouterModel: 'test-model',
    localModel: 'local-model',
    temperature: 0.9,
    maxTokens: 1500,
    contextWindow: 70000,
    systemPrompt: 'You are a literary narrator.',
    localUrl: 'http://localhost:8080',
    apiKey: '',
    customUrl: '',
    customApiKey: '',
  },
  addToastFn: vi.fn(),
}))

vi.mock('../../lib/edgeApi', () => ({
  streamLlmChat: vi.fn(async () => ''),
}))

vi.mock('../../lib/utils', () => ({
  buildKVContext: vi.fn((scenario, paragraphs) => {
    const paras = paragraphs.map((p: any) => p.text).join('\n')
    return `[Story World]\n${scenario.setting}\n\n[Companion/NPC]\n${scenario.companion}\n\n[Your Role]\n${scenario.player}\n\n[Recent Events]\n${paras}`
  }),
}))

vi.mock('../../stores', () => ({
  useStoryStore: vi.fn(() => ({
    story: storeState.story,
    chapters: storeState.chapters,
    activeChapterIndex: storeState.activeChapterIndex,
    isGenerating: storeState.isGenerating,
    addParagraph: storeState.addParagraphFn,
    updateParagraph: storeState.updateParagraphFn,
    setGenerating: storeState.setGeneratingFn,
  })),
  useSettingsStore: vi.fn((selector: any) => selector({ llm: storeState.llm })),
  useUiStore: vi.fn((selector: any) => selector({ addToast: storeState.addToastFn })),
}))

import { InputArea } from './InputArea'
import { streamLlmChat } from '../../lib/edgeApi'

const mockStory = {
  id: 'story-1',
  title: 'Test Story',
  scenario: {
    setting: 'A fantasy world',
    companion: 'A wise guide',
    player: 'The hero',
    hook: 'Begin your adventure',
  },
  userId: 'user-1',
  scenarioId: 'scenario-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockChapter = {
  title: 'Chapter I',
  paragraphs: [],
  order: 0,
}

function resetStores() {
  storeState.story = null
  storeState.chapters = []
  storeState.activeChapterIndex = 0
  storeState.isGenerating = false
  storeState.addParagraphFn.mockClear()
  storeState.updateParagraphFn.mockClear()
  storeState.setGeneratingFn.mockClear()
  storeState.addToastFn.mockClear()
  vi.clearAllMocks()
}

describe('InputArea', () => {
  beforeEach(() => {
    resetStores()
    ;(streamLlmChat as ReturnType<typeof vi.fn>).mockResolvedValue('')
  })

  describe('handleSend', () => {
    it('sends "continue" message when input is empty', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const sendBtn = screen.getByRole('button', { name: /continue/i })
      fireEvent.click(sendBtn)

      const { streamLlmChat: sllc } = await import('../../lib/edgeApi')
      const messages = (sllc as ReturnType<typeof vi.fn>).mock.calls[0][0].messages
      const userMsg = messages.find((m: any) => m.role === 'user')?.content ?? ''
      expect(userMsg).toContain('Continue the story naturally')
      expect(userMsg).not.toContain('Rewrite')
    })

    it('sends "rewrite" message when user provides text', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const textarea = screen.getByPlaceholderText(/what do you do/i)
      fireEvent.change(textarea, { target: { value: 'I draw my sword' } })
      const sendBtn = screen.getByRole('button', { name: /continue/i })
      fireEvent.click(sendBtn)

      const { streamLlmChat: sllc } = await import('../../lib/edgeApi')
      const messages = (sllc as ReturnType<typeof vi.fn>).mock.calls[0][0].messages
      const userMsg = messages.find((m: any) => m.role === 'user')?.content ?? ''
      expect(userMsg).toContain('Rewrite')
      expect(userMsg).toContain('I draw my sword')
    })

    it('does nothing when already generating', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]
      storeState.isGenerating = true

      render(<InputArea />)

      const sendBtn = screen.getByRole('button', { name: /\u2026/i })
      fireEvent.click(sendBtn)

      const { streamLlmChat: sllc } = await import('../../lib/edgeApi')
      expect(sllc).not.toHaveBeenCalled()
    })

    it('does nothing when no story exists', async () => {
      resetStores()

      const { container } = render(<InputArea />)
      expect(container.children.length).toBe(0)

      const { streamLlmChat: sllc } = await import('../../lib/edgeApi')
      expect(sllc).not.toHaveBeenCalled()
    })
  })

  describe('handleKey', () => {
    it('calls handleSend on Enter key', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const textarea = screen.getByPlaceholderText(/what do you do/i)
      fireEvent.change(textarea, { target: { value: 'test input' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      const { streamLlmChat: sllc } = await import('../../lib/edgeApi')
      expect(sllc).toHaveBeenCalled()
    })

    it('does NOT call handleSend on Shift+Enter', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const textarea = screen.getByPlaceholderText(/what do you do/i)
      fireEvent.change(textarea, { target: { value: 'test input' } })
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      const { streamLlmChat: sllc } = await import('../../lib/edgeApi')
      expect(sllc).not.toHaveBeenCalled()
    })
  })

  describe('ctxSize memo', () => {
    it('calculates context size based on system prompt and KV context', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const tokenText = screen.getByText(/tokens/i)
      expect(tokenText).toBeDefined()

      const text = tokenText.textContent ?? ''
      const match = text.match(/~([\d,]+)/)
      expect(match).not.toBeNull()
      const displayedTokens = parseInt(match![1].replace(/,/g, ''), 10)
      expect(displayedTokens).toBeGreaterThan(0)
    })

    it('reflects context window size in calculation', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const tokenText = screen.getByText(/tokens/i)
      const text = tokenText.textContent ?? ''
      expect(text).toMatch(/~[\d,]+ tokens/)
    })
  })

  describe('full send flow', () => {
    it('updates story store with paragraph when streaming completes', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      const streamedText = 'The hero draws his sword and charges forward.'
      ;(streamLlmChat as ReturnType<typeof vi.fn>).mockImplementation(
        async (_: any, onChunk: (chunk: string) => void) => {
          onChunk(streamedText)
          return streamedText
        },
      )

      render(<InputArea />)

      const textarea = screen.getByPlaceholderText(/what do you do/i)
      await userEvent.type(textarea, 'I charge into battle{Enter}')

      expect(storeState.addParagraphFn).toHaveBeenCalledWith(
        0,
        streamedText,
        'narrator',
      )
    })
  })

  describe('error handling', () => {
    it('shows error toast when streamLlmChat throws', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      ;(streamLlmChat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Connection refused'),
      )

      render(<InputArea />)

      const textarea = screen.getByPlaceholderText(/what do you do/i)
      await userEvent.type(textarea, 'test{Enter}')

      expect(storeState.addToastFn).toHaveBeenCalledWith('Connection refused', 'error')
    })

    it('shows generic error message for non-Error rejections', async () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      ;(streamLlmChat as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error')

      render(<InputArea />)

      const textarea = screen.getByPlaceholderText(/what do you do/i)
      await userEvent.type(textarea, 'test{Enter}')

      expect(storeState.addToastFn).toHaveBeenCalledWith('Generation failed', 'error')
    })
  })

  describe('token count display', () => {
    it('displays token count based on context size', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const tokenText = screen.getByText(/tokens/i)
      expect(tokenText).toBeDefined()
    })

    it('displays approximate token count using 4-char estimate', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      const tokenText = screen.getByText(/tokens/i)
      const text = tokenText.textContent ?? ''
      expect(text).toMatch(/~[\d,]+ tokens/)
    })
  })

  describe('component rendering', () => {
    it('renders textarea and send button', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      expect(screen.getByPlaceholderText(/what do you do/i)).toBeDefined()
      expect(screen.getByRole('button', { name: /continue/i })).toBeDefined()
    })

    it('shows disabled state when generating', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]
      storeState.isGenerating = true

      render(<InputArea />)

      const sendBtn = screen.getByRole('button', { name: /\u2026/i })
      expect(sendBtn.disabled).toBe(true)

      const textarea = screen.getByRole('textbox')
      expect(textarea.disabled).toBe(true)
    })

    it('shows writing placeholder when generating', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]
      storeState.isGenerating = true

      render(<InputArea />)

      const textarea = screen.getByRole('textbox')
      expect(textarea.getAttribute('placeholder')).toBe('Writing\u2026')
    })

    it('shows normal placeholder when not generating', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]
      storeState.isGenerating = false

      render(<InputArea />)

      const textarea = screen.getByRole('textbox')
      expect(textarea.getAttribute('placeholder')).toBe('What do you do\u2026')
    })

    it('returns null when no story exists', () => {
      resetStores()

      const { container } = render(<InputArea />)
      expect(container.children.length).toBe(0)
    })

    it('disables send button when generating', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]
      storeState.isGenerating = true

      render(<InputArea />)

      const sendBtn = screen.getByRole('button', { name: /\u2026/i })
      expect(sendBtn.disabled).toBe(true)
    })

    it('shows instruction text for keyboard shortcuts', () => {
      storeState.story = mockStory
      storeState.chapters = [mockChapter]

      render(<InputArea />)

      expect(screen.getByText(/Enter to send/i)).toBeDefined()
      expect(screen.getByText(/Shift\+Enter/i)).toBeDefined()
    })
  })
})
