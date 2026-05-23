import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Draft } from '../types/story'

const mock = vi.hoisted(() => ({
  navigate: vi.fn(),
  restoreDraft: vi.fn<[string], Promise<boolean>>().mockResolvedValue(true),
  saveToCloud: vi.fn(),
  removeDraft: vi.fn(),
  loadDrafts: vi.fn<[], Promise<any[]>>().mockResolvedValue([]),
  syncDraft: vi.fn(),
  storySetState: vi.fn(),
  storyGetState: vi.fn(() => ({ syncDraft: mock.syncDraft })),
  user: { uid: 'test-user-uid' } as { uid: string } | null,
  generateId: vi.fn(() => 'test-id'),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mock.navigate,
}))

vi.mock('../lib/utils', () => ({
  generateId: mock.generateId,
}))

vi.mock('../scenarios', () => ({
  SCENARIOS: [
    { id: 'custom', title: 'Custom World', sub: 'Start from a blank page', tag: 'Custom', setting: '', char: '', hook: '', player: '' },
    { id: 'isekai', title: 'Isekai Transit', sub: 'A stranger in a world of swords and sorcery', tag: 'Isekai', setting: 'Kingdom of Aetherholm — feudal high-magic realm, cobblestone towns, guilds, airships, demon invasion imminent on the eastern border.', char: 'Lyra — half-elf bard guide, has shepherded otherworlders before, knows too much.', hook: 'You wake in a wheat field at dawn. A girl in travel leathers is staring at you.', player: 'A modern human, no magic, oddly immune to mind-control — very valuable.' },
    { id: 'dungeon', title: 'The Forgotten Dungeon', sub: 'Ruin, treasure, and things that should stay buried', tag: 'Dungeon', setting: 'Sprawling underground ruin beneath Thornwood Forest. Crumbling corridors, phosphorescent moss, ancient magical constructs.', char: 'Arix — stone golem guardian, three hundred years old, sarcastic, knows every trap.', hook: 'You fall through a rotting floor into a chamber sealed for three centuries. A torch ignites on its own.', player: 'Adventurer seeking the Orb of Echoes. Short sword, lockpicks, half-used spell scroll.' },
    { id: 'cyber', title: 'Neon Exodus', sub: 'Rain-slicked megacity, corporate wars, black-market chrome', tag: 'Cyberpunk', setting: 'Neo-Hakodate, 2097. Six megacorps carved the city. Between them: the Sprawl — 40 floors of unregulated chaos.', char: 'Spectre — disembodied AI in your neural implant. Amoral, information-addicted.', hook: 'Your contact is dead. Their last encrypted message has coordinates and one word: EXODUS.', player: 'Mid-tier fixer, cracked cyberleg, reputation for discretion, debt to the wrong corp.' },
    { id: 'spirit', title: 'Spirit Realm Negotiator', sub: 'Yokai courts, shrine bargains, the politics of the unseen', tag: 'Mythology', setting: 'Feudal Japan in the Spirit Mirror — parallel realm, shrines are embassies, every deity has a seat.', char: 'Kitsune-no-Nana — seven-tailed fox spirit, ancient, mercurial, bound to you by childhood contract.', hook: 'Your childhood shrine has gone dark. The rice offerings rot overnight. All nine factions blame each other.', player: 'Travelling monk with rare ability to see through spirit-illusions. Indispensable — and a target.' },
    { id: 'romance', title: "The Noble's Gambit", sub: 'Intrigue, poison, and a throne no one should want', tag: 'Romance', setting: 'Imperial Court of Velundra — masquerades, poisoned wine, three factions each believe the throne is theirs.', char: 'Lord Caelion — third son of a rival house, dangerously charming, hiding a secret.', hook: 'An invitation arrives sealed in black wax. The masquerade ball is tonight.', player: "Merchant's child given a hollow title and tasked with unmasking a traitor." },
  ],
}))

vi.mock('../stores', () => ({
  useAuthStore: vi.fn(() => ({ user: mock.user })),
  useStoryStore: Object.assign(
    vi.fn(() => ({
      restoreDraft: mock.restoreDraft,
      saveToCloud: mock.saveToCloud,
      removeDraft: mock.removeDraft,
      loadDrafts: mock.loadDrafts,
    })),
    { setState: mock.storySetState, getState: mock.storyGetState },
  ),
  useUiStore: vi.fn(() => ({ addToast: vi.fn() })),
}))

import { HomePage } from './HomePage'

const SCENARIO_TITLES = [
  'Custom World',
  'Isekai Transit',
  'The Forgotten Dungeon',
  'Neon Exodus',
  'Spirit Realm Negotiator',
  "The Noble's Gambit",
]

const mockDraft = {
  id: 'draft-1',
  story: {
    id: 'story-1',
    userId: 'test-user-uid',
    title: 'My Saved Story',
    subtitle: 'A test adventure',
    scenarioId: 'isekai',
    scenario: { setting: 'World', companion: 'Guide', player: 'Hero', hook: 'Begin' },
    createdAt: 1000,
    updatedAt: 1000,
  },
  chapters: [
    {
      id: 'ch-1',
      title: 'Chapter I',
      order: 0,
      createdAt: 1000,
      updatedAt: 1000,
      paragraphs: [
        { id: 'p-1', text: 'Once upon a time...', role: 'narrator' as const, images: [], imageDescriptions: [], order: 0 },
      ],
    },
  ],
  activeChapterIndex: 0,
  savedAt: 1000,
}

const isekaiScenario = {
  id: 'isekai',
  title: 'Isekai Transit',
  sub: 'A stranger in a world of swords and sorcery',
  tag: 'Isekai',
  setting: 'Kingdom of Aetherholm — feudal high-magic realm, cobblestone towns, guilds, airships, demon invasion imminent on the eastern border.',
  char: 'Lyra — half-elf bard guide, has shepherded otherworlders before, knows too much.',
  hook: 'You wake in a wheat field at dawn. A girl in travel leathers is staring at you.',
  player: 'A modern human, no magic, oddly immune to mind-control — very valuable.',
}

function renderPage() {
  return render(<HomePage />)
}

function selectScenario(name = 'Isekai Transit') {
  fireEvent.click(screen.getByText(name))
}

function clickBeginNovel() {
  fireEvent.click(screen.getByRole('button', { name: /begin novel/i }))
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.user = { uid: 'test-user-uid' }
    mock.loadDrafts.mockResolvedValue([])
    mock.restoreDraft.mockResolvedValue(true)
  })

  // =========================================================================
  // UNIT TESTS
  // =========================================================================

  describe('handleSelect', () => {
    it('pre-fills form fields from selected scenario', () => {
      renderPage()
      selectScenario()

      expect((screen.getByPlaceholderText('Give your world a name...') as HTMLInputElement).value).toBe(isekaiScenario.title)
      expect((screen.getByPlaceholderText('Add extra details to the scenario setting...') as HTMLTextAreaElement).value).toBe(isekaiScenario.setting)
      expect((screen.getByPlaceholderText('Name and description') as HTMLInputElement).value).toBe(isekaiScenario.char)
      expect((screen.getByPlaceholderText('Who you are in this world') as HTMLInputElement).value).toBe(isekaiScenario.player)
      expect((screen.getByPlaceholderText('e.g. You wake in a unfamiliar place\u2026') as HTMLInputElement).value).toBe(isekaiScenario.hook)
    })

    it('switching selections updates form fields', () => {
      renderPage()
      selectScenario('Isekai Transit')
      selectScenario('The Forgotten Dungeon')

      const dungeon = SCENARIO_TITLES[2]
      expect((screen.getByPlaceholderText('Give your world a name...') as HTMLInputElement).value).toBe(dungeon)
    })
  })

  describe('handleBegin', () => {
    it('creates story with selected scenario values', () => {
      renderPage()
      selectScenario()
      clickBeginNovel()

      expect(mock.storySetState).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({
            id: 'test-id',
            userId: 'test-user-uid',
            title: isekaiScenario.title,
            subtitle: isekaiScenario.sub,
            scenarioId: isekaiScenario.id,
            scenario: expect.objectContaining({
              setting: isekaiScenario.setting,
              companion: isekaiScenario.char,
              player: isekaiScenario.player,
              hook: isekaiScenario.hook,
            }),
          }),
          chapters: expect.arrayContaining([
            expect.objectContaining({ title: 'Chapter I', order: 0, paragraphs: [] }),
          ]),
          activeChapterIndex: 0,
        }),
      )
      expect(mock.storyGetState).toHaveBeenCalled()
      expect(mock.syncDraft).toHaveBeenCalled()
      expect(mock.navigate).toHaveBeenCalledWith('/novel')
    })

    it('uses custom values when provided in form fields', () => {
      renderPage()
      selectScenario()

      fireEvent.change(screen.getByPlaceholderText('Give your world a name...'), { target: { value: 'My Custom World' } })
      fireEvent.change(screen.getByPlaceholderText('Add extra details to the scenario setting...'), { target: { value: 'A completely custom setting.' } })
      fireEvent.change(screen.getByPlaceholderText('Name and description'), { target: { value: 'A custom companion.' } })
      fireEvent.change(screen.getByPlaceholderText('Who you are in this world'), { target: { value: 'A custom role.' } })
      fireEvent.change(screen.getByPlaceholderText('e.g. You wake in a unfamiliar place\u2026'), { target: { value: 'A custom hook.' } })

      clickBeginNovel()

      expect(mock.storySetState).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({
            title: 'My Custom World',
            scenario: expect.objectContaining({
              setting: 'A completely custom setting.',
              companion: 'A custom companion.',
              player: 'A custom role.',
              hook: 'A custom hook.',
            }),
          }),
        }),
      )
    })

    it('falls back to scenario defaults when custom fields are empty', () => {
      renderPage()
      selectScenario()

      fireEvent.change(screen.getByPlaceholderText('Give your world a name...'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('Add extra details to the scenario setting...'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('Name and description'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('Who you are in this world'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('e.g. You wake in a unfamiliar place\u2026'), { target: { value: '' } })

      clickBeginNovel()

      expect(mock.storySetState).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({
            title: isekaiScenario.title,
            scenario: expect.objectContaining({
              setting: isekaiScenario.setting,
              companion: isekaiScenario.char,
              player: isekaiScenario.player,
              hook: isekaiScenario.hook,
            }),
          }),
        }),
      )
    })

    it('falls back to hardcoded defaults when both custom and scenario fields are empty', () => {
      renderPage()
      selectScenario('Custom World')

      fireEvent.change(screen.getByPlaceholderText('Describe your world - the setting, time period, mood, and key elements that make it unique...'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('Who will guide or accompany you in this world? Give them personality and background...'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('Who are you in this world? What is your role, background, and special qualities...'), { target: { value: '' } })
      fireEvent.change(screen.getByPlaceholderText('How does your adventure begin? What is the inciting incident that kicks off your story...'), { target: { value: '' } })

      clickBeginNovel()

      expect(mock.storySetState).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({
            scenario: expect.objectContaining({
              setting: 'A mysterious fantasy world.',
              companion: 'A mysterious guide.',
              player: 'A traveller seeking answers.',
              hook: 'The adventure begins.',
            }),
          }),
        }),
      )
    })

    it('returns early when user is not logged in', () => {
      mock.user = null
      renderPage()
      selectScenario()
      clickBeginNovel()

      expect(mock.storySetState).not.toHaveBeenCalled()
      expect(mock.navigate).not.toHaveBeenCalled()
    })
  })

  describe('handleContinue', () => {
    it('navigates to novel page on success', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft])
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('My Saved Story')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      expect(mock.restoreDraft).toHaveBeenCalledWith('draft-1')
      await waitFor(() => {
        expect(mock.navigate).toHaveBeenCalledWith('/novel')
      })
    })

    it('does not navigate when restoreDraft returns false', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft])
      mock.restoreDraft.mockResolvedValue(false)
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('My Saved Story')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      expect(mock.restoreDraft).toHaveBeenCalled()
      await waitFor(() => {
        expect(mock.navigate).not.toHaveBeenCalled()
      })
    })
  })

  describe('handleDeleteDraft', () => {
    it('removes draft from local state', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft])
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('My Saved Story')).toBeDefined()
      })

      const deleteBtn = screen.getByTitle('Delete draft')
      fireEvent.click(deleteBtn)

      expect(mock.removeDraft).toHaveBeenCalledWith('draft-1')

      await waitFor(() => {
        expect(screen.queryByText('My Saved Story')).toBeNull()
      })
    })
  })

  // =========================================================================
  // INTEGRATION TESTS
  // =========================================================================

  describe('integration - full create flow', () => {
    it('select scenario, customize fields, begin — story created and navigated', () => {
      renderPage()
      selectScenario()

      fireEvent.change(screen.getByPlaceholderText('Give your world a name...'), { target: { value: 'My Realm' } })
      fireEvent.change(screen.getByPlaceholderText('Add extra details to the scenario setting...'), { target: { value: 'Custom setting details' } })

      clickBeginNovel()

      expect(mock.storySetState).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({
            title: 'My Realm',
            scenario: expect.objectContaining({
              setting: 'Custom setting details',
              companion: isekaiScenario.char,
              player: isekaiScenario.player,
              hook: isekaiScenario.hook,
            }),
          }),
        }),
      )
      expect(mock.navigate).toHaveBeenCalledWith('/novel')
    })

    it('select scenario, pre-fill, modify fields, begin with overrides', () => {
      renderPage()
      selectScenario()

      expect((screen.getByPlaceholderText('Give your world a name...') as HTMLInputElement).value).toBe(isekaiScenario.title)
      expect((screen.getByPlaceholderText('Name and description') as HTMLInputElement).value).toBe(isekaiScenario.char)

      fireEvent.change(screen.getByPlaceholderText('Give your world a name...'), { target: { value: 'Overridden World' } })
      fireEvent.change(screen.getByPlaceholderText('Name and description'), { target: { value: 'New companion' } })

      clickBeginNovel()

      expect(mock.storySetState).toHaveBeenCalledWith(
        expect.objectContaining({
          story: expect.objectContaining({
            title: 'Overridden World',
            scenario: expect.objectContaining({
              setting: isekaiScenario.setting,
              companion: 'New companion',
              player: isekaiScenario.player,
              hook: isekaiScenario.hook,
            }),
          }),
        }),
      )
    })
  })

  describe('integration - draft flows', () => {
    it('continue draft navigates to novel page', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft])
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('My Saved Story')).toBeDefined()
      })

      fireEvent.click(screen.getByRole('button', { name: /continue/i }))

      expect(mock.restoreDraft).toHaveBeenCalledWith('draft-1')
      await waitFor(() => {
        expect(mock.navigate).toHaveBeenCalledWith('/novel')
      })
    })

    it('delete draft removes it from the list', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft])
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('My Saved Story')).toBeDefined()
      })

      const deleteBtn = screen.getByTitle('Delete draft')
      fireEvent.click(deleteBtn)

      expect(mock.removeDraft).toHaveBeenCalledWith('draft-1')
      await waitFor(() => {
        expect(screen.queryByText('My Saved Story')).toBeNull()
      })
    })
  })

  // =========================================================================
  // SYSTEM / COMPONENT TESTS
  // =========================================================================

  describe('scenario card rendering', () => {
    it('renders all 6 scenario cards', () => {
      renderPage()

      for (const title of SCENARIO_TITLES) {
        expect(screen.getByText(title)).toBeDefined()
      }
    })

    it('renders subtitles for all scenarios', () => {
      renderPage()

      expect(screen.getByText('Start from a blank page')).toBeDefined()
      expect(screen.getByText('A stranger in a world of swords and sorcery')).toBeDefined()
      expect(screen.getByText('Ruin, treasure, and things that should stay buried')).toBeDefined()
      expect(screen.getByText('Rain-slicked megacity, corporate wars, black-market chrome')).toBeDefined()
      expect(screen.getByText('Yokai courts, shrine bargains, the politics of the unseen')).toBeDefined()
      expect(screen.getByText('Intrigue, poison, and a throne no one should want')).toBeDefined()
    })

    it('renders tags for all scenarios', () => {
      renderPage()

      expect(screen.getByText('Custom')).toBeDefined()
      expect(screen.getByText('Isekai')).toBeDefined()
      expect(screen.getByText('Dungeon')).toBeDefined()
      expect(screen.getByText('Cyberpunk')).toBeDefined()
      expect(screen.getByText('Mythology')).toBeDefined()
      expect(screen.getByText('Romance')).toBeDefined()
    })
  })

  describe('modal and form rendering', () => {
    it('renders custom scenario form inside modal when a scenario is selected', () => {
      renderPage()
      selectScenario()

      expect(screen.getByPlaceholderText('Give your world a name...')).toBeDefined()
      expect(screen.getByPlaceholderText('Add extra details to the scenario setting...')).toBeDefined()
      expect(screen.getByPlaceholderText('Name and description')).toBeDefined()
      expect(screen.getByPlaceholderText('Who you are in this world')).toBeDefined()
      expect(screen.getByPlaceholderText('e.g. You wake in a unfamiliar place\u2026')).toBeDefined()
    })

    it('renders Begin Novel and Cancel buttons in modal', () => {
      renderPage()
      selectScenario()

      expect(screen.getByRole('button', { name: /begin novel/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined()
    })

    it('modal closes when Cancel is clicked', () => {
      renderPage()
      selectScenario()

      expect(screen.getByPlaceholderText('Give your world a name...')).toBeDefined()

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(screen.queryByPlaceholderText('Give your world a name...')).toBeNull()
    })
  })

  describe('draft list rendering', () => {
    it('renders draft list when user has drafts', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft])
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('Your Stories')).toBeDefined()
        expect(screen.getByText('My Saved Story')).toBeDefined()
      })
    })

    it('hides draft section when user has no drafts', async () => {
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.queryByText('Your Stories')).toBeNull()
      })
    })

    it('renders continue, save to cloud, and delete buttons for each draft', async () => {
      mock.loadDrafts.mockResolvedValue([mockDraft, { ...mockDraft, id: 'draft-2', story: { ...mockDraft.story, title: 'Second Story' } }])
      renderPage()
      await act(async () => {})

      await waitFor(() => {
        expect(screen.getByText('Second Story')).toBeDefined()
      })

      const continueBtns = screen.getAllByRole('button', { name: /continue/i })
      expect(continueBtns).toHaveLength(2)

      const saveCloudBtns = screen.getAllByRole('button', { name: /save to cloud/i })
      expect(saveCloudBtns).toHaveLength(2)

      const deleteBtns = screen.getAllByTitle('Delete draft')
      expect(deleteBtns).toHaveLength(2)
    })
  })

  describe('scenario selection highlighting', () => {
    it('highlights selected scenario card', () => {
      renderPage()
      selectScenario('Isekai Transit')

      const cards = screen.getAllByText('Isekai Transit')
      const card = cards[0].closest('[class*="cursor-pointer"]')!
      expect(card.className).toContain('border-[var(--accent)]')
      expect(card.className).toContain('shadow-[0_0_0_1px_var(--accent)]')
    })

    it('clears highlight from previously selected card', () => {
      renderPage()
      selectScenario('Isekai Transit')
      selectScenario('The Forgotten Dungeon')

      const dungeonCards = screen.getAllByText('The Forgotten Dungeon')
      const dungeonCard = dungeonCards[0].closest('[class*="cursor-pointer"]')!
      expect(dungeonCard.className).toContain('border-[var(--accent)]')
      expect(dungeonCard.className).toContain('shadow-[0_0_0_1px_var(--accent)]')

      const isekaiCards = screen.getAllByText('Isekai Transit')
      const isekaiCard = isekaiCards[0].closest('[class*="cursor-pointer"]')!
      expect(isekaiCard.className).not.toContain('shadow-[0_0_0_1px_var(--accent)]')
    })
  })
})
