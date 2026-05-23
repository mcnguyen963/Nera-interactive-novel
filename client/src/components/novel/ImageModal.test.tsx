import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockStoreState = vi.hoisted(() => ({
  showImageModal: true,
  imageModalTitle: 'Test Image',
  imageModalPrompt: 'a majestic dragon',
  imageModalTargetChapterIndex: 0,
  imageModalTargetParagraphIndex: 0,
  closeImageModal: vi.fn(),
  isGeneratingImage: false,
  setGeneratingImage: vi.fn(),
  setImageModalPrompt: vi.fn(),
  addToast: vi.fn(),
  image: {
    provider: 'local',
    localUrl: 'http://localhost:7860',
    cloudApiKey: '',
    model: 'flux',
    corsProxyUrl: '',
    comfyWorkflow: '',
  },
  llm: {
    provider: 'openrouter',
    localUrl: 'http://localhost:8080',
    localModel: 'local-model',
    openrouterModel: 'test-model',
    customUrl: '',
    customApiKey: '',
    apiKey: '',
    temperature: 0.9,
    maxTokens: 1500,
    contextWindow: 70000,
    systemPrompt: 'You are a literary narrator.',
  },
  story: null as Record<string, unknown> | null,
  chapters: [] as { title: string; paragraphs: { text: string }[]; order: number }[],
  addImageToParagraph: vi.fn(),
}))

vi.mock('../../lib/edgeApi', () => ({
  generateImage: vi.fn(),
  simpleChat: vi.fn(),
}))

vi.mock('../../lib/utils', () => ({
  buildKVContext: vi.fn(() => 'mocked story context'),
}))

vi.mock('../../stores', () => ({
  useUiStore: vi.fn(() => ({
    showImageModal: mockStoreState.showImageModal,
    imageModalTitle: mockStoreState.imageModalTitle,
    imageModalPrompt: mockStoreState.imageModalPrompt,
    imageModalTargetChapterIndex: mockStoreState.imageModalTargetChapterIndex,
    imageModalTargetParagraphIndex: mockStoreState.imageModalTargetParagraphIndex,
    closeImageModal: mockStoreState.closeImageModal,
    isGeneratingImage: mockStoreState.isGeneratingImage,
    setGeneratingImage: mockStoreState.setGeneratingImage,
    setImageModalPrompt: mockStoreState.setImageModalPrompt,
    addToast: mockStoreState.addToast,
  })),
  useSettingsStore: Object.assign(
    vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        image: mockStoreState.image,
        llm: mockStoreState.llm,
      }
      return selector ? selector(state) : state
    }),
    {
      getState: vi.fn(() => ({
        llm: mockStoreState.llm,
        image: mockStoreState.image,
      })),
    },
  ),
  useStoryStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
      story: mockStoreState.story,
      chapters: mockStoreState.chapters,
      addImageToParagraph: mockStoreState.addImageToParagraph,
    })),
  }),
}))

import { ImageModal } from './ImageModal'
import { generateImage, simpleChat } from '../../lib/edgeApi'

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
  paragraphs: [
    { text: 'The hero stood at the crossroads.' },
    { text: 'A dragon appeared in the sky.' },
  ],
  order: 0,
}

function resetMockState() {
  mockStoreState.showImageModal = true
  mockStoreState.imageModalTitle = 'Test Image'
  mockStoreState.imageModalPrompt = 'a majestic dragon'
  mockStoreState.imageModalTargetChapterIndex = 0
  mockStoreState.imageModalTargetParagraphIndex = 0
  mockStoreState.closeImageModal.mockClear()
  mockStoreState.isGeneratingImage = false
  mockStoreState.setGeneratingImage.mockClear()
  mockStoreState.setImageModalPrompt.mockClear()
  mockStoreState.addToast.mockClear()
  mockStoreState.story = null
  mockStoreState.chapters = []
  mockStoreState.addImageToParagraph.mockClear()
  vi.clearAllMocks()
}

// =========================================================================
// UNIT TESTS - handleGenerate
// =========================================================================

describe('unit - handleGenerate', () => {
  beforeEach(() => {
    resetMockState()
    mockStoreState.imageModalPrompt = 'a majestic dragon'
  })

  it('generates image with URL successfully', async () => {
    const imgUrl = 'http://img.test/dragon.png'
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: imgUrl, description: 'A majestic dragon in flight' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.setGeneratingImage).toHaveBeenCalledWith(true)
    })

    await waitFor(() => {
      expect(mockStoreState.setGeneratingImage).toHaveBeenCalledWith(false)
    })

    expect(mockStoreState.addToast).toHaveBeenCalledWith('Image generated', 'success')
    expect(generateImage).toHaveBeenCalled()

    await waitFor(() => {
      const img = screen.getByRole('img')
      expect(img).toBeDefined()
      expect(img.getAttribute('src')).toBe(imgUrl)
    })
  })

  it('generates image with description only (no URL)', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: '', description: 'A majestic dragon in flight' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('Image generated', 'success')
    })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('A majestic dragon in flight')).toBeDefined()
  })

  it('shows error toast when generateImage returns HTTP error', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('HTTP 500', 'error')
    })
  })

  it('shows error toast when generateImage returns data.error', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('Rate limited', 'error')
    })
  })

  it('shows error toast when generateImage throws', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection failed'))

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('Connection failed', 'error')
    })
  })

  it('shows generic error toast for non-Error rejection', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockRejectedValue('string error')

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('Image generation failed', 'error')
    })
  })

  it('shows error toast when no result returned (no url and no description)', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: '', description: '' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith(
        'Nothing was generated — check your image provider settings',
        'error',
      )
    })
  })

  it('returns early when prompt is empty', async () => {
    mockStoreState.imageModalPrompt = ''

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    expect(generateImage).not.toHaveBeenCalled()
    expect(mockStoreState.setGeneratingImage).not.toHaveBeenCalled()
  })
})

// =========================================================================
// UNIT TESTS - handleWritePrompt
// =========================================================================

describe('unit - handleWritePrompt', () => {
  beforeEach(() => {
    resetMockState()
    mockStoreState.story = mockStory as unknown as Record<string, unknown>
    mockStoreState.chapters = [mockChapter]
  })

  it('generates prompt from story context via LLM', async () => {
    const generatedPrompt = 'A majestic dragon soaring through storm clouds above a medieval castle'
    ;(simpleChat as ReturnType<typeof vi.fn>).mockResolvedValue(generatedPrompt)

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    fireEvent.click(writeBtn)

    await waitFor(() => {
      expect(mockStoreState.setImageModalPrompt).toHaveBeenCalledWith(generatedPrompt)
    })

    expect(simpleChat).toHaveBeenCalled()
  })

  it('returns early when no story exists', async () => {
    mockStoreState.story = null

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    fireEvent.click(writeBtn)

    expect(simpleChat).not.toHaveBeenCalled()
  })

  it('shows error toast when LLM returns empty response', async () => {
    ;(simpleChat as ReturnType<typeof vi.fn>).mockResolvedValue('')

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    fireEvent.click(writeBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('LLM returned empty response', 'error')
    })
  })

  it('shows error toast when simpleChat throws', async () => {
    ;(simpleChat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM unavailable'))

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    fireEvent.click(writeBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('LLM unavailable', 'error')
    })
  })

  it('shows generic error for non-Error rejection in simpleChat', async () => {
    ;(simpleChat as ReturnType<typeof vi.fn>).mockRejectedValue('fail')

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    fireEvent.click(writeBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('Failed to generate prompt', 'error')
    })
  })
})

// =========================================================================
// UNIT TESTS - handleAddToNovel
// =========================================================================

describe('unit - handleAddToNovel', () => {
  beforeEach(async () => {
    resetMockState()
    mockStoreState.imageModalPrompt = 'a majestic dragon'
    mockStoreState.chapters = [{ ...mockChapter, paragraphs: [{ text: 'The hero stood.' }, { text: 'A dragon appeared.' }] }]
  })

  it('adds image to correct paragraph via addImageToParagraph', async () => {
    const imgUrl = 'http://img.test/dragon.png'
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: imgUrl, description: 'A dragon' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeDefined()
    })

    const addBtn = screen.getByRole('button', { name: /add to novel/i })
    fireEvent.click(addBtn)

    expect(mockStoreState.addImageToParagraph).toHaveBeenCalledWith(0, 0, imgUrl, 'A dragon')
    expect(mockStoreState.addToast).toHaveBeenCalledWith('Image added to paragraph', 'success')
    expect(mockStoreState.closeImageModal).toHaveBeenCalled()
  })

  it('shows error toast when no paragraphs are available', async () => {
    const imgUrl = 'http://img.test/dragon.png'
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: imgUrl, description: 'A dragon' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeDefined()
    })

    mockStoreState.chapters = [{ title: 'Chapter I', paragraphs: [], order: 0 }]

    const addBtn = screen.getByRole('button', { name: /add to novel/i })
    fireEvent.click(addBtn)

    expect(mockStoreState.addImageToParagraph).not.toHaveBeenCalled()
    expect(mockStoreState.addToast).toHaveBeenCalledWith(
      'No paragraphs available to add image to',
      'error',
    )
  })
})

// =========================================================================
// INTEGRATION TESTS
// =========================================================================

describe('integration', () => {
  beforeEach(() => {
    resetMockState()
    mockStoreState.imageModalPrompt = 'a majestic dragon'
    mockStoreState.story = mockStory as unknown as Record<string, unknown>
    mockStoreState.chapters = [mockChapter]
  })

  it('full flow: generate image with URL, display preview, then add to novel', async () => {
    const imgUrl = 'http://img.test/dragon.png'
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: imgUrl, description: 'A dragon' }),
    })

    render(<ImageModal />)

    expect(screen.getByPlaceholderText('Enter an image generation prompt...')).toBeDefined()
    expect(screen.getByText('Click generate to create an image.')).toBeDefined()

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      const img = screen.getByRole('img')
      expect(img.getAttribute('src')).toBe(imgUrl)
    })

    const addBtn = screen.getByRole('button', { name: /add to novel/i })
    fireEvent.click(addBtn)

    expect(mockStoreState.addImageToParagraph).toHaveBeenCalled()
    expect(mockStoreState.addToast).toHaveBeenCalledWith('Image added to paragraph', 'success')
    expect(mockStoreState.closeImageModal).toHaveBeenCalled()
  })

  it('full flow: generate image failure shows error toast', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API unavailable'))

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalledWith('API unavailable', 'error')
    })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /add to novel/i })).toBeNull()
  })

  it('full flow: write prompt updates the prompt field', async () => {
    const generatedPrompt = 'A dragon soaring above a castle at sunset'
    ;(simpleChat as ReturnType<typeof vi.fn>).mockResolvedValue(generatedPrompt)

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    fireEvent.click(writeBtn)

    await waitFor(() => {
      expect(mockStoreState.setImageModalPrompt).toHaveBeenCalledWith(generatedPrompt)
    })

    expect(mockStoreState.addToast).not.toHaveBeenCalled()
  })
})

// =========================================================================
// SYSTEM / COMPONENT TESTS
// =========================================================================

describe('system - component rendering', () => {
  beforeEach(() => {
    resetMockState()
    mockStoreState.imageModalPrompt = 'a majestic dragon'
  })

  it('renders modal with title, prompt field, and all buttons', () => {
    render(<ImageModal />)

    expect(screen.getByText('Test Image')).toBeDefined()
    expect(screen.getByPlaceholderText('Enter an image generation prompt...')).toBeDefined()
    expect(screen.getByRole('button', { name: /write from story/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^Generate$/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /close/i })).toBeDefined()
  })

  it('shows placeholder text when no result exists', () => {
    render(<ImageModal />)

    expect(screen.getByText('Click generate to create an image.')).toBeDefined()
  })

  it('shows image preview when URL is set after generation', async () => {
    const imgUrl = 'http://img.test/preview.png'
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: imgUrl, description: 'Preview image' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      const img = screen.getByRole('img')
      expect(img.getAttribute('src')).toBe(imgUrl)
      expect(img.getAttribute('alt')).toBe('Generated')
    })
  })

  it('shows description text when description is set without URL', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: '', description: 'A vivid scene description' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByText('A vivid scene description')).toBeDefined()
    })
  })

  it('shows Add to Novel button when image result exists', async () => {
    const imgUrl = 'http://img.test/dragon.png'
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: imgUrl, description: 'A dragon' }),
    })

    render(<ImageModal />)

    expect(screen.queryByRole('button', { name: /add to novel/i })).toBeNull()

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to novel/i })).toBeDefined()
    })
  })

  it('shows Add to Novel button when description exists without URL', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: '', description: 'A scene' }),
    })

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add to novel/i })).toBeDefined()
    })
  })

  it('hides Add to Novel button when generation fails', async () => {
    ;(generateImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'))

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    fireEvent.click(generateBtn)

    await waitFor(() => {
      expect(mockStoreState.addToast).toHaveBeenCalled()
    })

    expect(screen.queryByRole('button', { name: /add to novel/i })).toBeNull()
  })

  it('shows generating state on generate button', () => {
    mockStoreState.isGeneratingImage = true

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /generating/i })
    expect(generateBtn).toBeDefined()
    expect((generateBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows writing prompt state on write button', () => {
    mockStoreState.isGeneratingImage = true

    render(<ImageModal />)

    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    expect((writeBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables generate and write buttons during image generation', () => {
    mockStoreState.isGeneratingImage = true

    render(<ImageModal />)

    const generateBtn = screen.getByRole('button', { name: /generating/i })
    const writeBtn = screen.getByRole('button', { name: /write from story/i })
    expect((generateBtn as HTMLButtonElement).disabled).toBe(true)
    expect((writeBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders prompt textarea with current value from store', () => {
    render(<ImageModal />)

    const textarea = screen.getByPlaceholderText('Enter an image generation prompt...') as HTMLTextAreaElement
    expect(textarea.value).toBe('a majestic dragon')
  })

  it('close button calls closeImageModal', () => {
    render(<ImageModal />)

    const closeButtons = screen.getAllByRole('button', { name: /✕|close/i })
    fireEvent.click(closeButtons[0])

    expect(mockStoreState.closeImageModal).toHaveBeenCalled()
  })
})
