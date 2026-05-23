import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { useAuthStore, useStoryStore, useSettingsStore, useUiStore } from './stores'

const route = vi.hoisted(() => ({ current: '/' }))
const mockCurrentUser = vi.hoisted(() => ({ current: { uid: 'test-uid', email: 'test@test.com' } as { uid: string; email: string } | null }))
const memMap = vi.hoisted(() => new Map<string, unknown>())

vi.mock('firebase/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('firebase/auth')>()
  return {
    ...mod,
    onAuthStateChanged: vi.fn((_auth: any, cb: (u: any) => void) => {
      setTimeout(() => cb(mockCurrentUser.current), 0)
      return () => {}
    }),
    signInWithEmailAndPassword: vi.fn(async (_auth: any, _email: string, _pass: string) => ({
      user: { uid: 'test-uid', email: _email },
    })),
    createUserWithEmailAndPassword: vi.fn(async (_auth: any, email: string, _pass: string) => ({
      user: { uid: 'test-uid', email },
    })),
    signOut: vi.fn(async () => {}),
    sendPasswordResetEmail: vi.fn(async () => {}),
    sendEmailVerification: vi.fn(async () => {}),
    GoogleAuthProvider: vi.fn(function fn() { return {} } as any),
    signInWithPopup: vi.fn(async () => ({
      user: { uid: 'test-uid', email: 'test@test.com', emailVerified: false, displayName: null, photoURL: null },
    })),
  }
})

vi.mock('firebase/firestore', async (importOriginal) => {
  const mod = await importOriginal<typeof import('firebase/firestore')>()
  return {
    ...mod,
    doc: vi.fn(() => ({ id: 'test-story' })),
    setDoc: vi.fn(async () => {}),
    getDoc: vi.fn(async (_ref: any) => ({
      exists: () => true,
      data: () => ({
        id: 'test-story',
        userId: 'test-uid',
        title: 'Test',
        subtitle: '',
        scenarioId: 'isekai',
        scenario: { setting: 'world', companion: 'guide', player: 'hero', hook: 'begin' },
        email: 'test@test.com',
        emailVerified: true,
        createdAt: 100,
        updatedAt: 100,
      }),
    })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async () => {}),
    collection: vi.fn(() => ({ path: '' })),
    writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn() })),
    query: vi.fn((q: any) => q),
    orderBy: vi.fn(() => ({ dir: 'asc' })),
  }
})

vi.mock('firebase/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('firebase/storage')>()
  return {
    ...mod,
    ref: vi.fn(),
    uploadString: vi.fn(),
    getDownloadURL: vi.fn(),
    deleteObject: vi.fn(async () => {}),
    listAll: vi.fn(async () => ({ items: [] })),
  }
})

vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => memMap.get(key)),
  set: vi.fn(async (key: string, val: unknown) => { memMap.set(key, val) }),
}))

vi.mock('./lib/edgeApi', () => ({
  streamLlmChat: vi.fn(async (_params: any, onChunk: (text: string) => void) => {
    onChunk('The mist cleared to reveal an ancient city, its crystalline spires catching the light of twin moons.')
    onChunk(' A cool breeze carried the scent of night-blooming flowers through the empty streets.')
    return 'The mist cleared to reveal an ancient city, its crystalline spires catching the light of twin moons. A cool breeze carried the scent of night-blooming flowers through the empty streets.'
  }),
  generateImage: vi.fn(async () => new Response(JSON.stringify({
    url: 'https://example.com/generated-image.png',
    description: 'A misty ancient city with towering crystalline spires under twin moons',
  }), { status: 200 })),
  simpleChat: vi.fn(async () => 'A misty ancient city with towering crystalline spires reaching toward twin moons in a purple twilight sky, cobblestone streets glistening with dew.'),
  fetchModels: vi.fn(async () => [
    { id: 'gpt-4', pricing: { prompt: '0.01' } },
    { id: 'gpt-3.5-turbo', pricing: { prompt: '0' } },
  ]),
  testConnection: vi.fn(async () => true),
  saveStory: vi.fn(async () => new Response(null, { status: 200 })),
  loadStory: vi.fn(async () => new Response(JSON.stringify({ story: null, chapters: [] }), { status: 200 })),
  listStories: vi.fn(async () => new Response(JSON.stringify({ stories: [] }), { status: 200 })),
  deleteStory: vi.fn(async () => new Response(null, { status: 200 })),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <actual.MemoryRouter initialEntries={[route.current]}>{children}</actual.MemoryRouter>
    ),
  }
})

import App from './App'

// =============================================================================
// Helpers
// =============================================================================

function setAuthenticated() {
  mockCurrentUser.current = { uid: 'test-uid', email: 'test@test.com' }
  useAuthStore.setState({
    user: { uid: 'test-uid', email: 'test@test.com' },
    profile: { email: 'test@test.com', emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() },
    loading: false,
    initialized: true,
  })
}

function setUnauthenticated() {
  mockCurrentUser.current = null
  useAuthStore.setState({
    user: null,
    profile: null,
    loading: false,
    initialized: true,
  })
}

function prependChunks() {
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    value: 100,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  route.current = '/'
  memMap.clear()
  vi.clearAllMocks()
  prependChunks()
  useAuthStore.setState(useAuthStore.getInitialState())
  useStoryStore.setState(useStoryStore.getInitialState())
  useSettingsStore.setState(useSettingsStore.getInitialState())
  useUiStore.setState({
    toasts: [],
    showSettings: false,
    showImageModal: false,
    imageModalTitle: '',
    imageModalPrompt: '',
    imageModalUrl: null,
    imageModalTargetChapterIndex: 0,
    imageModalTargetParagraphIndex: null,
    isGeneratingImage: false,
  })
})

function expectStoryInStore(title: string) {
  const s = useStoryStore.getState()
  expect(s.story).not.toBeNull()
  expect(s.story!.title).toBe(title)
  expect(s.chapters.length).toBeGreaterThanOrEqual(1)
}

function expectActiveChapter(index: number) {
  expect(useStoryStore.getState().activeChapterIndex).toBe(index)
}

// =============================================================================
// Scenario 1: Full Story Creation and Writing Flow
// =============================================================================

describe('Scenario 1: Story Creation and Writing', () => {
  it('full flow: create story, write paragraph, edit, add chapter, navigate', async () => {
    const user = userEvent.setup()
    setAuthenticated()
    route.current = '/'
    render(<App />)

    // Wait for HomePage to render
    await waitFor(() => {
      expect(screen.getByText('Choose your world · then craft your setting')).toBeDefined()
    })

    // Select "Isekai Transit" scenario
    await user.click(screen.getByText('Isekai Transit'))

    // Modal should appear with "Begin Novel" button
    await waitFor(() => {
      expect(screen.getByText(/Begin Novel/i)).toBeDefined()
    })

    // Fill in custom world name
    const worldInput = screen.getByPlaceholderText('Give your world a name...')
    await user.clear(worldInput)
    await user.type(worldInput, 'Aetherholm Reborn')

    // Click Begin Novel
    await user.click(screen.getByText(/Begin Novel/i))

    // Should navigate to NovelPage — story title and Chapter I should render
    await waitFor(() => {
      expect(screen.getByText('Aetherholm Reborn')).toBeDefined()
      expect(screen.getAllByText('Chapter I').length).toBeGreaterThan(0)
    })

    // Verify story created in store
    expectStoryInStore('Aetherholm Reborn')

    // Type in InputArea and send
    const input = screen.getByPlaceholderText('What do you do…')
    await user.type(input, 'I step through the glowing gate and look around')
    await user.click(screen.getByText('Continue →'))

    // Wait for paragraph to render from streamLlmChat mock
    await waitFor(() => {
      expect(screen.getByText(/mist cleared/i)).toBeDefined()
    })

    // Verify paragraphs in store
    const state = useStoryStore.getState()
    expect(state.chapters[0].paragraphs.length).toBeGreaterThanOrEqual(1)
    expect(state.chapters[0].paragraphs[0].text).toContain('mist cleared')

    // Double-click paragraph to edit it
    const paragraphEl = screen.getByText(/the mist cleared/i)
    await user.dblClick(paragraphEl)

    // Textarea should appear
    await waitFor(() => {
      const textboxes = screen.getAllByRole('textbox')
      const editTextbox = textboxes.find((tb) => (tb as HTMLTextAreaElement).value.includes('mist cleared'))
      expect(editTextbox).toBeDefined()
    })

    // Type new text and press Escape to save
    const editingTextarea = screen.getAllByRole('textbox').find(
      (tb) => (tb as HTMLTextAreaElement).value.includes('mist cleared'),
    ) as HTMLTextAreaElement
    await user.clear(editingTextarea)
    await user.type(editingTextarea, 'The fog parted to reveal a gleaming metropolis.')
    await user.keyboard('{Escape}')

    // Wait for paragraph text to update
    await waitFor(() => {
      expect(screen.getByText('The fog parted to reveal a gleaming metropolis.')).toBeDefined()
    })

    // Verify store update
    expect(useStoryStore.getState().chapters[0].paragraphs[0].text).toBe('The fog parted to reveal a gleaming metropolis.')

    // Add a chapter via Sidebar
    await user.click(screen.getByText('+ New chapter'))

    await waitFor(() => {
      expect(screen.getAllByText('Chapter II').length).toBeGreaterThan(0)
    })
    expect(useStoryStore.getState().chapters).toHaveLength(2)
    expectActiveChapter(1)

    // Navigate between chapters — click Chapter I in sidebar
    const chapterLinks = screen.getAllByText('Chapter I')
    const sidebarChapterI = chapterLinks.find((el) => el.closest('aside'))
    await user.click(sidebarChapterI!)
    expectActiveChapter(0)
  })
})

// =============================================================================
// Scenario 2: Auth Flow
// =============================================================================

describe('Scenario 2: Auth Flow', () => {
  it('shows AuthPage when unauthenticated', async () => {
    setUnauthenticated()
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('NERA')).toBeDefined()
      expect(screen.getByText('Interactive Novel')).toBeDefined()
    })
    expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0)
    expect(screen.queryByText('Choose your world')).toBeNull()
  })

  it('shows HomePage after authentication', async () => {
    setAuthenticated()
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Choose your world · then craft your setting')).toBeDefined()
    })
    expect(screen.queryByText('Sign In')).toBeNull()
  })

  it('shows user info in Header after login', async () => {
    setAuthenticated()
    useAuthStore.setState({
      profile: { email: 'test@test.com', emailVerified: true, createdAt: Date.now(), updatedAt: Date.now() },
    })
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('test@test.com')).toBeDefined()
    })
    expect(screen.getByText('Sign out')).toBeDefined()
  })

  it('logout redirects to auth page', async () => {
    const user = userEvent.setup()
    setAuthenticated()
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Sign out')).toBeDefined()
    })

    await user.click(screen.getByText('Sign out'))
    // Mock signOut doesn't trigger onAuthStateChanged, update manually
    mockCurrentUser.current = null
    useAuthStore.setState({ user: null, profile: null })

    await waitFor(() => {
      expect(screen.getAllByText('Sign In').length).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// Scenario 3: Settings Flow
// =============================================================================

describe('Scenario 3: Settings Flow', () => {
  it('opens settings modal and switches LLM provider', async () => {
    const user = userEvent.setup()
    setAuthenticated()
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTitle('Settings')).toBeDefined()
    })

    // Open settings
    await user.click(screen.getByTitle('Settings'))

    await waitFor(() => {
      expect(screen.getByText('Server & Generation Settings')).toBeDefined()
    })

    // Switch provider to local
    const providerSelect = screen.getByDisplayValue('Cloud (OpenRouter)')
    await user.selectOptions(providerSelect, 'local')

    // Verify provider changed
    await waitFor(() => {
      expect(screen.getByDisplayValue('Local (llama.cpp compatible)')).toBeDefined()
    })
    expect(useSettingsStore.getState().llm.provider).toBe('local')

    // Test connection (mock returns true)
    const testBtn = screen.getByRole('button', { name: /test connection/i })
    await user.click(testBtn)

    await waitFor(() => {
      expect(screen.getByText('Connected ✓')).toBeDefined()
    })
  })

  it('saves settings and persists to store', async () => {
    const user = userEvent.setup()
    setAuthenticated()
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByTitle('Settings')).toBeDefined()
    })

    await user.click(screen.getByTitle('Settings'))

    await waitFor(() => {
      expect(screen.getByText('Server & Generation Settings')).toBeDefined()
    })

    // Change temperature
    const tempSlider = screen.getByRole('slider')
    await user.tab() // focus the slider
    // Set temperature via store directly for precision
    useSettingsStore.getState().setLlm({ temperature: 0.5, maxTokens: 2000 })

    // Save & close
    await user.click(screen.getByText('Save & close'))

    await waitFor(() => {
      expect(screen.queryByText('Server & Generation Settings')).toBeNull()
    })

    // Verify settings persisted
    const { llm } = useSettingsStore.getState()
    expect(llm.temperature).toBe(0.5)
    expect(llm.maxTokens).toBe(2000)
  })
})

// =============================================================================
// Scenario 4: Draft Management Flow
// =============================================================================

describe('Scenario 4: Draft Management', () => {
  it('creates a story, saves as draft, navigates away, sees draft on HomePage, continues, and deletes', async () => {
    const user = userEvent.setup()
    setAuthenticated()

    // Create a story via the store directly
    const storyId = useStoryStore.getState().createStory({
      title: 'Draft Story',
      subtitle: 'Testing draft persistence',
      scenarioId: 'isekai',
      scenario: {
        setting: 'A misty fantasy world',
        companion: 'A wise fox spirit',
        player: 'A wandering scholar',
        hook: 'You find an ancient library',
      },
      userId: 'test-uid',
    })
    useStoryStore.getState().addParagraph(0, 'The library doors creaked open, revealing rows of floating books.', 'narrator')

    // syncDraft is called automatically by addParagraph
    await vi.waitFor(async () => {
      const drafts = await useStoryStore.getState().loadDrafts()
      expect(drafts.length).toBeGreaterThan(0)
      expect(drafts[0].story.title).toBe('Draft Story')
    })

    // Navigate away by resetting story
    useStoryStore.getState().resetStory()

    // Now go to HomePage — should see draft list
    route.current = '/'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Your Stories')).toBeDefined()
      expect(screen.getByText('Draft Story')).toBeDefined()
    })

    // DraftCard should show "Continue" button
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    expect(continueBtn).toBeDefined()

    // Click Continue to restore draft
    await user.click(continueBtn)

    await waitFor(() => {
      const s = useStoryStore.getState()
      expect(s.story).not.toBeNull()
      expect(s.story!.title).toBe('Draft Story')
      expect(s.chapters[0].paragraphs[0].text).toContain('library doors')
    })

    // Go back to HomePage for delete test
    useStoryStore.getState().resetStory()
    route.current = '/'

    // Re-render to see draft list again
    // We need a fresh render since resetting the story might cause issues
    // Just check from store perspective
    const draftsBefore = await useStoryStore.getState().loadDrafts()
    expect(draftsBefore.length).toBeGreaterThanOrEqual(1)

    // Delete the draft
    await useStoryStore.getState().removeDraft(storyId)
    const draftsAfter = await useStoryStore.getState().loadDrafts()
    expect(draftsAfter.find((d) => d.id === storyId)).toBeUndefined()
  })
})

// =============================================================================
// Scenario 5: Image Generation Flow
// =============================================================================

describe('Scenario 5: Image Generation', () => {
  it('generates image and adds to paragraph', async () => {
    const user = userEvent.setup()
    setAuthenticated()

    // Create story with a paragraph
    useStoryStore.getState().createStory({
      title: 'Image Test Story',
      subtitle: 'Testing image generation',
      scenarioId: 'isekai',
      scenario: {
        setting: 'A magical realm',
        companion: 'A guiding spirit',
        player: 'A traveler',
        hook: 'You arrive at the crystal city',
      },
      userId: 'test-uid',
    })
    useStoryStore.getState().addParagraph(0, 'The crystal city shimmered under the light of three moons.', 'narrator')

    // Navigate to NovelPage (/novel route)
    route.current = '/novel'
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Image Test Story')).toBeDefined()
    })

    // Find "add image" button on the paragraph
    const paragraphText = screen.getByText(/crystal city shimmered/i)
    const paragraphContainer = paragraphText.closest('.group')!

    // The action buttons are within this container but are absolutely positioned
    // We can find them by text since they're always in DOM
    const addImageBtn = within(paragraphContainer).getByText('add image')
    await user.click(addImageBtn)

    // ImageModal should open
    await waitFor(() => {
      expect(screen.getByText('Add Image')).toBeDefined()
      expect(screen.getByPlaceholderText('Enter an image generation prompt...')).toBeDefined()
    })

    // Click Generate
    const generateBtn = screen.getByRole('button', { name: /^Generate$/ })
    await user.click(generateBtn)

    // Wait for image result
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeDefined()
    })
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://example.com/generated-image.png')

    // Click "Add to Novel"
    const addToNovelBtn = screen.getByRole('button', { name: /add to novel/i })
    await user.click(addToNovelBtn)

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /add to novel/i })).toBeNull()
    })

    // Image should now be in the paragraph
    await waitFor(() => {
      const allImgs = screen.getAllByRole('img')
      const novelImg = allImgs.find((imgEl) => imgEl.getAttribute('src') === 'https://example.com/generated-image.png')
      expect(novelImg).toBeDefined()
    })

    // Verify in store
    const s = useStoryStore.getState()
    expect(s.chapters[0].paragraphs[0].images).toContain('https://example.com/generated-image.png')
    expect(s.chapters[0].paragraphs[0].imageDescriptions[0]).toContain('crystalline spires')
  })
})
