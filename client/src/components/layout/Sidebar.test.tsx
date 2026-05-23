import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const storeState = vi.hoisted(() => ({
  story: null as any,
  chapters: [] as any[],
  activeChapterIndex: 0,
  setActiveChapter: vi.fn(),
  addChapter: vi.fn(),
  saveToLocal: vi.fn(),
  loadFromLocal: vi.fn(),
  listLocalStories: vi.fn(),
  openImageModal: vi.fn(),
  addToast: vi.fn(),
  isGeneratingImage: false,
}))

vi.mock('../../stores', () => ({
  useStoryStore: vi.fn((selector?: any) => {
    const state = {
      story: storeState.story,
      chapters: storeState.chapters,
      activeChapterIndex: storeState.activeChapterIndex,
      setActiveChapter: storeState.setActiveChapter,
      addChapter: storeState.addChapter,
      saveToLocal: storeState.saveToLocal,
      loadFromLocal: storeState.loadFromLocal,
      listLocalStories: storeState.listLocalStories,
    }
    return selector ? selector(state) : state
  }),
  useUiStore: vi.fn((selector?: any) => {
    const state = {
      openImageModal: storeState.openImageModal,
      addToast: storeState.addToast,
      isGeneratingImage: storeState.isGeneratingImage,
    }
    return selector ? selector(state) : state
  }),
}))

import { Sidebar } from './Sidebar'

const mockChapter = (id: string, title: string, order: number = 0) => ({
  id,
  title,
  order,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  paragraphs: [],
})

const mockStory = {
  id: 'story-1',
  userId: 'user-1',
  title: 'Test Story',
  subtitle: 'A test',
  scenarioId: 'scenario-1',
  scenario: {
    setting: 'A fantasy world with dragons',
    companion: 'A wise old wizard',
    player: 'A brave knight',
    hook: 'Begin your quest',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

function resetStores() {
  storeState.story = null
  storeState.chapters = []
  storeState.activeChapterIndex = 0
  storeState.isGeneratingImage = false
  vi.clearAllMocks()
}

// =========================================================================
// UNIT TESTS
// =========================================================================

describe('Sidebar', () => {
  beforeEach(() => {
    resetStores()
  })

  describe('unit - chapter list rendering', () => {
    it('renders chapter titles for each chapter', () => {
      storeState.chapters = [
        mockChapter('ch-1', 'Prologue', 0),
        mockChapter('ch-2', 'Chapter I', 1),
        mockChapter('ch-3', 'Chapter II', 2),
      ]
      render(<Sidebar />)
      expect(screen.getByText('Prologue')).toBeDefined()
      expect(screen.getByText('Chapter I')).toBeDefined()
      expect(screen.getByText('Chapter II')).toBeDefined()
    })

    it('highlights active chapter with accent styling', () => {
      storeState.chapters = [
        mockChapter('ch-1', 'Chapter I', 0),
        mockChapter('ch-2', 'Chapter II', 1),
        mockChapter('ch-3', 'Chapter III', 2),
      ]
      storeState.activeChapterIndex = 1
      render(<Sidebar />)
      const items = screen.getAllByText(/Chapter/)
      const chapterDivs = items.filter((el) => el.tagName === 'DIV')
      expect(chapterDivs[0].className).not.toContain('accent')
      expect(chapterDivs[1].className).toContain('accent')
      expect(chapterDivs[2].className).not.toContain('accent')
    })

    it('calls setActiveChapter with correct index when chapter is clicked', () => {
      storeState.chapters = [
        mockChapter('ch-1', 'Chapter I', 0),
        mockChapter('ch-2', 'Chapter II', 1),
      ]
      storeState.activeChapterIndex = 0
      render(<Sidebar />)
      fireEvent.click(screen.getByText('Chapter II'))
      expect(storeState.setActiveChapter).toHaveBeenCalledWith(1)
    })

    it('calls setActiveChapter with first index when first chapter is clicked', () => {
      storeState.chapters = [
        mockChapter('ch-1', 'Chapter I', 0),
        mockChapter('ch-2', 'Chapter II', 1),
      ]
      storeState.activeChapterIndex = 1
      render(<Sidebar />)
      fireEvent.click(screen.getByText('Chapter I'))
      expect(storeState.setActiveChapter).toHaveBeenCalledWith(0)
    })

    it('does not render chapter list when chapters array is empty', () => {
      render(<Sidebar />)
      const chapterDivs = screen.queryAllByText(/Chapter/).filter((el) => el.tagName === 'DIV')
      expect(chapterDivs).toHaveLength(0)
    })
  })

  describe('unit - active chapter index behavior', () => {
    it('defaults activeChapterIndex to 0 when no chapters exist', () => {
      render(<Sidebar />)
      const chapterDivs = screen.queryAllByText(/Chapter/).filter((el) => el.tagName === 'DIV')
      expect(chapterDivs).toHaveLength(0)
    })

    it('first chapter is active when activeChapterIndex is 0', () => {
      storeState.chapters = [mockChapter('ch-1', 'Chapter I', 0)]
      storeState.activeChapterIndex = 0
      render(<Sidebar />)
      const item = screen.getByText('Chapter I')
      expect(item.className).toContain('accent')
    })
  })

  describe('unit - add chapter button', () => {
    it('renders add chapter button with correct text', () => {
      render(<Sidebar />)
      const btn = screen.getByText('+ New chapter')
      expect(btn).toBeDefined()
      expect(btn.tagName).toBe('BUTTON')
    })

    it('calls addChapter when clicked', () => {
      render(<Sidebar />)
      fireEvent.click(screen.getByText('+ New chapter'))
      expect(storeState.addChapter).toHaveBeenCalledTimes(1)
    })
  })

  describe('unit - generate scene button', () => {
    it('builds correct prompt from story setting and calls openImageModal', () => {
      storeState.story = mockStory
      storeState.activeChapterIndex = 2
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate scene image/))
      expect(storeState.openImageModal).toHaveBeenCalledWith(
        'Scene Illustration',
        'Scene illustration based on: A fantasy world with dragons',
        null,
        2,
      )
    })

    it('passes current activeChapterIndex to openImageModal', () => {
      storeState.story = mockStory
      storeState.activeChapterIndex = 0
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate scene image/))
      expect(storeState.openImageModal).toHaveBeenCalledWith(
        'Scene Illustration',
        expect.any(String),
        null,
        0,
      )
    })

    it('does not call openImageModal when story is null', () => {
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate scene image/))
      expect(storeState.openImageModal).not.toHaveBeenCalled()
    })

    it('disables button when isGeneratingImage is true', () => {
      storeState.isGeneratingImage = true
      render(<Sidebar />)
      const btn = screen.getByText(/Generate scene image/) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })

    it('enables button when isGeneratingImage is false', () => {
      render(<Sidebar />)
      const btn = screen.getByText(/Generate scene image/) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  describe('unit - generate character button', () => {
    it('builds correct prompt from story companion and calls openImageModal', () => {
      storeState.story = mockStory
      storeState.activeChapterIndex = 1
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate character portrait/))
      expect(storeState.openImageModal).toHaveBeenCalledWith(
        'Character Portrait',
        'Character portrait of A wise old wizard',
        null,
        1,
      )
    })

    it('passes current activeChapterIndex to openImageModal', () => {
      storeState.story = mockStory
      storeState.activeChapterIndex = 3
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate character portrait/))
      expect(storeState.openImageModal).toHaveBeenCalledWith(
        'Character Portrait',
        expect.any(String),
        null,
        3,
      )
    })

    it('does not call openImageModal when story is null', () => {
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate character portrait/))
      expect(storeState.openImageModal).not.toHaveBeenCalled()
    })

    it('disables button when isGeneratingImage is true', () => {
      storeState.isGeneratingImage = true
      render(<Sidebar />)
      const btn = screen.getByText(/Generate character portrait/) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })

    it('enables button when isGeneratingImage is false', () => {
      render(<Sidebar />)
      const btn = screen.getByText(/Generate character portrait/) as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })
  })

  describe('unit - save to local', () => {
    it('shows success toast when saveToLocal succeeds', async () => {
      storeState.story = mockStory
      storeState.saveToLocal.mockResolvedValue(true)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Save to local file/))
      await waitFor(() => {
        expect(storeState.saveToLocal).toHaveBeenCalled()
      })
      expect(storeState.addToast).toHaveBeenCalledWith('Saved to local files', 'success')
    })

    it('shows error toast when saveToLocal fails', async () => {
      storeState.story = mockStory
      storeState.saveToLocal.mockResolvedValue(false)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Save to local file/))
      await waitFor(() => {
        expect(storeState.saveToLocal).toHaveBeenCalled()
      })
      expect(storeState.addToast).toHaveBeenCalledWith('Failed to save locally', 'error')
    })

    it('propagates error when saveToLocal rejects (no catch in component)', async () => {
      storeState.story = mockStory
      storeState.saveToLocal.mockRejectedValue(new Error('disk full'))
      const onRejection = vi.fn()
      process.on('unhandledRejection', onRejection)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Save to local file/))
      await waitFor(() => {
        expect(storeState.saveToLocal).toHaveBeenCalled()
      })
      expect(storeState.addToast).not.toHaveBeenCalled()
      process.off('unhandledRejection', onRejection)
    })
  })

  describe('unit - load from local', () => {
    it('shows success toast when loadFromLocal succeeds', async () => {
      storeState.chapters = [mockChapter('ch-1', 'Loaded Chapter', 0)]
      storeState.listLocalStories.mockResolvedValue(['story-1'])
      storeState.loadFromLocal.mockResolvedValue(true)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Load from local file/))
      await waitFor(() => {
        expect(screen.getByText('story-1')).toBeDefined()
      })
      fireEvent.click(screen.getByText('story-1'))
      await waitFor(() => {
        expect(storeState.loadFromLocal).toHaveBeenCalledWith('story-1')
      })
      expect(storeState.addToast).toHaveBeenCalledWith('Loaded from local files', 'success')
    })

    it('shows error toast when loadFromLocal fails', async () => {
      storeState.listLocalStories.mockResolvedValue(['story-1'])
      storeState.loadFromLocal.mockResolvedValue(false)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Load from local file/))
      await waitFor(() => {
        expect(screen.getByText('story-1')).toBeDefined()
      })
      fireEvent.click(screen.getByText('story-1'))
      await waitFor(() => {
        expect(storeState.addToast).toHaveBeenCalledWith('Failed to load', 'error')
      })
    })
  })

  describe('unit - list local stories', () => {
    it('shows story IDs after listing local stories', async () => {
      storeState.listLocalStories.mockResolvedValue(['story-alpha', 'story-beta', 'story-gamma'])
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Load from local file/))
      await waitFor(() => {
        expect(storeState.listLocalStories).toHaveBeenCalled()
      })
      expect(screen.getByText('story-alpha')).toBeDefined()
      expect(screen.getByText('story-beta')).toBeDefined()
      expect(screen.getByText('story-gamma')).toBeDefined()
    })

    it('hides story list when listLocalStories returns empty', async () => {
      storeState.listLocalStories.mockResolvedValue([])
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Load from local file/))
      await waitFor(() => {
        expect(storeState.listLocalStories).toHaveBeenCalled()
      })
      expect(screen.queryByText(/story-/)).toBeNull()
    })

    it('shows no stories when listLocalStories rejects', async () => {
      storeState.listLocalStories.mockRejectedValue(new Error('network error'))
      const onRejection = vi.fn()
      process.on('unhandledRejection', onRejection)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Load from local file/))
      await waitFor(() => {
        expect(storeState.listLocalStories).toHaveBeenCalled()
      })
      expect(screen.queryByText(/story-/)).toBeNull()
      process.off('unhandledRejection', onRejection)
    })
  })
})

// =========================================================================
// INTEGRATION TESTS
// =========================================================================

describe('Sidebar - integration', () => {
  beforeEach(() => {
    resetStores()
  })

  describe('integration - chapter navigation', () => {
    it('clicking first chapter then second chapter updates active index correctly', () => {
      storeState.chapters = [
        mockChapter('ch-1', 'Chapter I', 0),
        mockChapter('ch-2', 'Chapter II', 1),
        mockChapter('ch-3', 'Chapter III', 2),
      ]
      storeState.activeChapterIndex = 0
      render(<Sidebar />)
      fireEvent.click(screen.getByText('Chapter II'))
      expect(storeState.setActiveChapter).toHaveBeenCalledWith(1)
      fireEvent.click(screen.getByText('Chapter III'))
      expect(storeState.setActiveChapter).toHaveBeenCalledWith(2)
    })

    it('adds a new chapter then navigates to it', () => {
      storeState.chapters = [mockChapter('ch-1', 'Chapter I', 0)]
      storeState.activeChapterIndex = 0
      render(<Sidebar />)
      fireEvent.click(screen.getByText('+ New chapter'))
      expect(storeState.addChapter).toHaveBeenCalled()
    })
  })

  describe('integration - scene and character generation', () => {
    it('generates scene and character in sequence with different prompts', () => {
      storeState.story = mockStory
      storeState.activeChapterIndex = 0
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate scene image/))
      expect(storeState.openImageModal).toHaveBeenNthCalledWith(
        1,
        'Scene Illustration',
        'Scene illustration based on: A fantasy world with dragons',
        null,
        0,
      )
      fireEvent.click(screen.getByText(/Generate character portrait/))
      expect(storeState.openImageModal).toHaveBeenNthCalledWith(
        2,
        'Character Portrait',
        'Character portrait of A wise old wizard',
        null,
        0,
      )
    })

    it('does not generate scene or character when story is null', () => {
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Generate scene image/))
      fireEvent.click(screen.getByText(/Generate character portrait/))
      expect(storeState.openImageModal).not.toHaveBeenCalled()
    })

    it('both buttons disabled when isGeneratingImage is true', () => {
      storeState.isGeneratingImage = true
      render(<Sidebar />)
      const sceneBtn = screen.getByText(/Generate scene image/) as HTMLButtonElement
      const charBtn = screen.getByText(/Generate character portrait/) as HTMLButtonElement
      expect(sceneBtn.disabled).toBe(true)
      expect(charBtn.disabled).toBe(true)
    })
  })

  describe('integration - save and load flow', () => {
    it('full local storage flow: save, list, then load', async () => {
      storeState.story = mockStory
      storeState.saveToLocal.mockResolvedValue(true)
      storeState.listLocalStories.mockResolvedValue(['story-1'])
      storeState.loadFromLocal.mockResolvedValue(true)
      render(<Sidebar />)
      fireEvent.click(screen.getByText(/Save to local file/))
      await waitFor(() => {
        expect(storeState.addToast).toHaveBeenCalledWith('Saved to local files', 'success')
      })
      fireEvent.click(screen.getByText(/Load from local file/))
      await waitFor(() => {
        expect(screen.getByText('story-1')).toBeDefined()
      })
      fireEvent.click(screen.getByText('story-1'))
      await waitFor(() => {
        expect(storeState.addToast).toHaveBeenCalledWith('Loaded from local files', 'success')
      })
    })
  })
})

// =========================================================================
// SYSTEM / COMPONENT TESTS
// =========================================================================

describe('Sidebar - system', () => {
  beforeEach(() => {
    resetStores()
  })

  describe('system - component rendering', () => {
    it('renders sidebar container as an aside element', () => {
      const { container } = render(<Sidebar />)
      const aside = container.querySelector('aside')
      expect(aside).not.toBeNull()
    })

    it('renders Chapters heading', () => {
      render(<Sidebar />)
      expect(screen.getByText('Chapters')).toBeDefined()
    })

    it('renders Local Storage heading', () => {
      render(<Sidebar />)
      expect(screen.getByText('Local Storage')).toBeDefined()
    })

    it('renders Scene Tools heading', () => {
      render(<Sidebar />)
      expect(screen.getByText('Scene Tools')).toBeDefined()
    })

    it('renders save, load, generate scene, and generate character buttons', () => {
      render(<Sidebar />)
      expect(screen.getByText(/Save to local file/)).toBeDefined()
      expect(screen.getByText(/Load from local file/)).toBeDefined()
      expect(screen.getByText(/Generate scene image/)).toBeDefined()
      expect(screen.getByText(/Generate character portrait/)).toBeDefined()
    })

    it('renders separator lines (hr elements)', () => {
      const { container } = render(<Sidebar />)
      const hrs = container.querySelectorAll('hr')
      expect(hrs.length).toBe(2)
    })
  })

  describe('system - empty story state', () => {
    it('renders properly when story is null and chapters are empty', () => {
      const { container } = render(<Sidebar />)
      expect(container.querySelector('aside')).not.toBeNull()
      expect(screen.getByText('Chapters')).toBeDefined()
    })

    it('save to local button is disabled when story is null', () => {
      render(<Sidebar />)
      const btn = screen.getByText(/Save to local file/) as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })
  })
})
