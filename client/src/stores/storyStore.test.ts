import { describe, it, expect, beforeEach, vi } from 'vitest'

const memMap = vi.hoisted(() => new Map<string, unknown>())

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => memMap.get(key)),
  set: vi.fn(async (key: string, val: unknown) => { memMap.set(key, val) }),
}))

import { get } from 'idb-keyval'

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    doc: vi.fn((_db: any, _path: string, ...ids: string[]) => ({ id: ids[0], path: _path })),
    getDoc: vi.fn(async (_ref: any) => ({ exists: () => true, data: () => ({ id: _ref.id, userId: 'test-user', title: 'Test', subtitle: '', scenarioId: 'isekai', scenario: { setting: 'world', companion: 'guide', player: 'hero', hook: 'begin' }, createdAt: 100, updatedAt: 100 }) })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async () => {}),
    collection: vi.fn((_db: any, _path: string) => ({ path: _path })),
    writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn() })),
    query: vi.fn((q: any) => q),
    orderBy: vi.fn(() => ({ dir: 'asc' })),
    getFirestore: vi.fn(() => ({})),
  }
})

vi.mock('../lib/firebase', () => ({
  db: {},
}))

import { useStoryStore } from './storyStore'

const mockScenario = {
  setting: 'A test world',
  companion: 'Test companion',
  player: 'Test hero',
  hook: 'Test hook',
}

describe('storyStore', () => {
  beforeEach(() => {
    memMap.clear()
    useStoryStore.setState(useStoryStore.getInitialState())
  })

  describe('initial state', () => {
    it('starts with no story', () => {
      const s = useStoryStore.getState()
      expect(s.story).toBeNull()
      expect(s.chapters).toEqual([])
      expect(s.activeChapterIndex).toBe(0)
      expect(s.isGenerating).toBe(false)
      expect(s.isSyncing).toBe(false)
    })
  })

  describe('createStory', () => {
    it('creates a story with one chapter', () => {
      const id = useStoryStore.getState().createStory({
        title: 'My Adventure',
        subtitle: 'A test',
        scenarioId: 'test-scenario',
        scenario: mockScenario,
        userId: 'user-1',
      })
      const { story, chapters } = useStoryStore.getState()
      expect(story).not.toBeNull()
      expect(story!.id).toBe(id)
      expect(story!.title).toBe('My Adventure')
      expect(story!.userId).toBe('user-1')
      expect(story!.scenario).toEqual(mockScenario)
      expect(chapters).toHaveLength(1)
      expect(chapters[0].title).toBe('Chapter I')
      expect(chapters[0].paragraphs).toEqual([])
      expect(chapters[0].order).toBe(0)
    })

    it('creates a story with timestamp', () => {
      const before = Date.now()
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      const s = useStoryStore.getState().story!
      expect(s.createdAt).toBeGreaterThanOrEqual(before)
      expect(s.updatedAt).toBeGreaterThanOrEqual(before)
    })
  })

  describe('updateStory', () => {
    it('updates story fields', () => {
      useStoryStore.getState().createStory({ title: 'Original', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      useStoryStore.getState().updateStory({ title: 'Updated' })
      expect(useStoryStore.getState().story!.title).toBe('Updated')
    })

    it('does nothing when no story exists', () => {
      useStoryStore.getState().updateStory({ title: 'Nope' })
      expect(useStoryStore.getState().story).toBeNull()
    })
  })

  describe('chapters', () => {
    it('sets active chapter index', () => {
      useStoryStore.getState().setActiveChapter(2)
      expect(useStoryStore.getState().activeChapterIndex).toBe(2)
    })

    it('adds chapters with roman numerals', () => {
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      useStoryStore.getState().addChapter()
      expect(useStoryStore.getState().chapters).toHaveLength(2)
      expect(useStoryStore.getState().chapters[1].title).toBe('Chapter II')
      expect(useStoryStore.getState().activeChapterIndex).toBe(1)
    })

    it('adds multiple chapters correctly', () => {
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      useStoryStore.getState().addChapter()
      useStoryStore.getState().addChapter()
      expect(useStoryStore.getState().chapters).toHaveLength(3)
      expect(useStoryStore.getState().chapters[2].title).toBe('Chapter III')
    })
  })

  describe('paragraphs', () => {
    beforeEach(() => {
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
    })

    it('adds a narrator paragraph', () => {
      const para = useStoryStore.getState().addParagraph(0, 'The sun rises.', 'narrator')
      expect(para.text).toBe('The sun rises.')
      expect(para.role).toBe('narrator')
      expect(para.order).toBe(0)
      expect(para.images).toEqual([])
      expect(useStoryStore.getState().chapters[0].paragraphs).toHaveLength(1)
    })

    it('adds a player paragraph', () => {
      const para = useStoryStore.getState().addParagraph(0, 'I look around.', 'player')
      expect(para.role).toBe('player')
    })

    it('increments paragraph order', () => {
      useStoryStore.getState().addParagraph(0, 'First', 'narrator')
      useStoryStore.getState().addParagraph(0, 'Second', 'narrator')
      const paras = useStoryStore.getState().chapters[0].paragraphs
      expect(paras[0].order).toBe(0)
      expect(paras[1].order).toBe(1)
    })

    it('updates a paragraph', () => {
      useStoryStore.getState().addParagraph(0, 'Old text', 'narrator')
      useStoryStore.getState().updateParagraph(0, 0, 'New text')
      expect(useStoryStore.getState().chapters[0].paragraphs[0].text).toBe('New text')
    })

    it('deletes a paragraph', () => {
      useStoryStore.getState().addParagraph(0, 'Keep me', 'narrator')
      useStoryStore.getState().addParagraph(0, 'Delete me', 'narrator')
      useStoryStore.getState().deleteParagraph(0, 1)
      expect(useStoryStore.getState().chapters[0].paragraphs).toHaveLength(1)
      expect(useStoryStore.getState().chapters[0].paragraphs[0].text).toBe('Keep me')
    })

    it('adds an image to a paragraph', () => {
      useStoryStore.getState().addParagraph(0, 'Scene', 'narrator')
      useStoryStore.getState().addImageToParagraph(0, 0, 'http://img.com/img.png')
      expect(useStoryStore.getState().chapters[0].paragraphs[0].images).toHaveLength(1)
      expect(useStoryStore.getState().chapters[0].paragraphs[0].images[0]).toBe('http://img.com/img.png')
    })
  })

  describe('setGenerating', () => {
    it('toggles generating flag', () => {
      useStoryStore.getState().setGenerating(true)
      expect(useStoryStore.getState().isGenerating).toBe(true)
      useStoryStore.getState().setGenerating(false)
      expect(useStoryStore.getState().isGenerating).toBe(false)
    })
  })

  describe('resetStory', () => {
    it('resets everything to initial state', () => {
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      useStoryStore.getState().addParagraph(0, 'text', 'narrator')
      useStoryStore.getState().resetStory()
      const s = useStoryStore.getState()
      expect(s.story).toBeNull()
      expect(s.chapters).toEqual([])
      expect(s.activeChapterIndex).toBe(0)
    })
  })

  describe('cloud operations', () => {
    it('saveToCloud writes to Firestore', async () => {
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      await expect(useStoryStore.getState().saveToCloud('u')).resolves.toBeUndefined()
    })

    it('deleteFromCloud deletes and resets', async () => {
      useStoryStore.getState().createStory({ title: 'T', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u' })
      await useStoryStore.getState().deleteFromCloud('story-id')
      expect(useStoryStore.getState().story).toBeNull()
    })

    it('lists cloud stories', async () => {
      const stories = await useStoryStore.getState().listCloudStories('u')
      expect(Array.isArray(stories)).toBe(true)
    })
  })

  describe('drafts', () => {
    it('createDraft stores a draft', async () => {
      const id = useStoryStore.getState().createStory({
        title: 'My Story', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u',
      })
      const { story, chapters } = useStoryStore.getState()
      await useStoryStore.getState().createDraft(id, story!, chapters)
      const drafts: any[] = (await get('nera-drafts')) || []
      const draft = drafts.find((d: any) => d.id === id)
      expect(draft).toBeDefined()
      expect(draft!.story.title).toBe('My Story')
      expect(draft!.story.id).toBe(id)
    })

    it('syncDraft updates existing draft', async () => {
      const id = useStoryStore.getState().createStory({
        title: 'My Story', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u',
      })
      const { story, chapters } = useStoryStore.getState()
      await useStoryStore.getState().createDraft(id, story!, chapters)
      useStoryStore.getState().addParagraph(0, 'A new paragraph.', 'narrator')
      await useStoryStore.getState().syncDraft()
      const drafts: any[] = (await get('nera-drafts')) || []
      const draft = drafts.find((d: any) => d.id === id)
      expect(draft!.chapters[0].paragraphs).toHaveLength(1)
      expect(draft!.chapters[0].paragraphs[0].text).toBe('A new paragraph.')
    })

    it('loadDrafts returns all drafts', async () => {
      const id = useStoryStore.getState().createStory({
        title: 'S1', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u',
      })
      const { story, chapters } = useStoryStore.getState()
      await useStoryStore.getState().createDraft(id, story!, chapters)
      const drafts = await useStoryStore.getState().loadDrafts()
      expect(drafts).toHaveLength(1)
      expect(drafts[0].story.title).toBe('S1')
    })

    it('restoreDraft sets store state and preserves draft', async () => {
      const id = useStoryStore.getState().createStory({
        title: 'S1', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u',
      })
      const { story, chapters } = useStoryStore.getState()
      await useStoryStore.getState().createDraft(id, story!, chapters)
      useStoryStore.getState().resetStory()
      const ok = await useStoryStore.getState().restoreDraft(id)
      expect(ok).toBe(true)
      expect(useStoryStore.getState().story?.title).toBe('S1')
      const drafts = await useStoryStore.getState().loadDrafts()
      expect(drafts.find((d: any) => d.id === id)).toBeDefined()
      expect(drafts.find((d: any) => d.id === id)!.story.title).toBe('S1')
    })

    it('removeDraft removes a draft', async () => {
      const id = useStoryStore.getState().createStory({
        title: 'S1', subtitle: '', scenarioId: 's', scenario: mockScenario, userId: 'u',
      })
      const { story, chapters } = useStoryStore.getState()
      await useStoryStore.getState().createDraft(id, story!, chapters)
      await useStoryStore.getState().removeDraft(id)
      const drafts = await useStoryStore.getState().loadDrafts()
      expect(drafts).toHaveLength(0)
    })
  })
})
