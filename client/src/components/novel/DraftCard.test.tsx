import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DraftCard } from './DraftCard'
import type { Draft } from '../../types/story'

function createDraft(overrides?: Partial<Draft>): Draft {
  return {
    id: 'draft-1',
    story: {
      id: 'story-1',
      userId: 'user-1',
      title: 'Test Story',
      subtitle: 'A test subtitle',
      scenarioId: 'scenario-1',
      scenario: {
        setting: 'A fantasy world',
        companion: 'A wise guide',
        player: 'The hero',
        hook: 'Begin your adventure',
      },
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    chapters: [],
    activeChapterIndex: 0,
    savedAt: 1700000000000,
    ...overrides,
  }
}

describe('DraftCard', () => {
  const baseDraft = createDraft({
    chapters: [
      {
        id: 'ch-1',
        title: 'Chapter I',
        order: 0,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        paragraphs: [
          { id: 'p-1', text: 'The hero stood at the edge of the forest.', role: 'narrator', images: [], imageDescriptions: [], order: 0 },
        ],
      },
    ],
  })

  describe('renders draft info', () => {
    it('renders story title and subtitle', () => {
      render(
        <DraftCard
          draft={baseDraft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.getByText('Test Story')).toBeDefined()
      expect(screen.getByText('A test subtitle')).toBeDefined()
    })

    it('renders chapter info and paragraph count', () => {
      render(
        <DraftCard
          draft={baseDraft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.getByText(/Ch I · 1 paragraphs/)).toBeDefined()
    })

    it('renders 0 paragraphs when no chapters exist', () => {
      render(
        <DraftCard
          draft={createDraft()}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.getByText('0 paragraphs')).toBeDefined()
    })

    it('uses roman numeral for active chapter index', () => {
      const draft = createDraft({
        activeChapterIndex: 2,
        chapters: [
          {
            id: 'ch-1', title: 'Chapter I', order: 0,
            createdAt: 1700000000000, updatedAt: 1700000000000,
            paragraphs: [
              { id: 'p-1', text: 'Para 1', role: 'narrator', images: [], imageDescriptions: [], order: 0 },
              { id: 'p-2', text: 'Para 2', role: 'player', images: [], imageDescriptions: [], order: 1 },
            ],
          },
        ],
      })

      render(
        <DraftCard
          draft={draft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      expect(screen.getByText(/Ch III · 2 paragraphs/)).toBeDefined()
    })
  })

  describe('snippet', () => {
    it('displays last paragraph text', () => {
      const draft = createDraft({
        chapters: [
          {
            id: 'ch-1', title: 'Chapter I', order: 0,
            createdAt: 1700000000000, updatedAt: 1700000000000,
            paragraphs: [
              { id: 'p-1', text: 'First paragraph.', role: 'narrator', images: [], imageDescriptions: [], order: 0 },
              { id: 'p-2', text: 'Second paragraph.', role: 'narrator', images: [], imageDescriptions: [], order: 1 },
            ],
          },
        ],
      })

      render(
        <DraftCard
          draft={draft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const snippetEl = screen.getByText(/".*"/)
      expect(snippetEl.textContent).toContain('Second paragraph.')
    })

    it('truncates at 50 chars showing last 50 characters', () => {
      const longText = 'A'.repeat(100)
      const draft = createDraft({
        chapters: [
          {
            id: 'ch-1', title: 'Chapter I', order: 0,
            createdAt: 1700000000000, updatedAt: 1700000000000,
            paragraphs: [
              { id: 'p-1', text: longText, role: 'narrator', images: [], imageDescriptions: [], order: 0 },
            ],
          },
        ],
      })

      render(
        <DraftCard
          draft={draft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const snippetEl = screen.getByText(/".*"/)
      const displayedText = snippetEl.textContent!.replace(/^"|"$/g, '')
      expect(displayedText).toBe('A'.repeat(50))
      expect(displayedText.length).toBe(50)
    })

    it('shows full text when 50 characters or fewer', () => {
      const shortText = 'Hello world'
      const draft = createDraft({
        chapters: [
          {
            id: 'ch-1', title: 'Chapter I', order: 0,
            createdAt: 1700000000000, updatedAt: 1700000000000,
            paragraphs: [
              { id: 'p-1', text: shortText, role: 'narrator', images: [], imageDescriptions: [], order: 0 },
            ],
          },
        ],
      })

      render(
        <DraftCard
          draft={draft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const snippetEl = screen.getByText(/".*"/)
      const displayedText = snippetEl.textContent!.replace(/^"|"$/g, '')
      expect(displayedText).toBe('Hello world')
    })

    it('handles empty paragraphs array', () => {
      render(
        <DraftCard
          draft={createDraft()}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const snippetEl = screen.getByText(/".*"/)
      expect(snippetEl.textContent).toContain('No paragraphs yet')
    })

    it('handles empty last paragraph text', () => {
      const draft = createDraft({
        chapters: [
          {
            id: 'ch-1', title: 'Chapter I', order: 0,
            createdAt: 1700000000000, updatedAt: 1700000000000,
            paragraphs: [
              { id: 'p-1', text: '', role: 'narrator', images: [], imageDescriptions: [], order: 0 },
            ],
          },
        ],
      })

      render(
        <DraftCard
          draft={draft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      const snippetEl = screen.getByText(/".*"/)
      expect(snippetEl.textContent).toContain('No paragraphs yet')
    })
  })

  describe('action buttons', () => {
    it('calls onContinue when Continue button is clicked', () => {
      const onContinue = vi.fn()

      render(
        <DraftCard
          draft={baseDraft}
          onContinue={onContinue}
          onSaveToCloud={vi.fn()}
          onDelete={vi.fn()}
        />,
      )

      fireEvent.click(screen.getByText('Continue'))
      expect(onContinue).toHaveBeenCalledWith('draft-1')
    })

    it('calls onDelete when delete button is clicked', () => {
      const onDelete = vi.fn()

      render(
        <DraftCard
          draft={baseDraft}
          onContinue={vi.fn()}
          onSaveToCloud={vi.fn()}
          onDelete={onDelete}
        />,
      )

      fireEvent.click(screen.getByTitle('Delete draft'))
      expect(onDelete).toHaveBeenCalledWith('draft-1')
    })

    it('calls onSaveToCloud when Save to Cloud button is clicked', () => {
      const onSaveToCloud = vi.fn()

      render(
        <DraftCard
          draft={baseDraft}
          onContinue={vi.fn()}
          onSaveToCloud={onSaveToCloud}
          onDelete={vi.fn()}
        />,
      )

      fireEvent.click(screen.getByText('Save to Cloud'))
      expect(onSaveToCloud).toHaveBeenCalledWith('draft-1')
    })

    it('passes correct draft id to all callbacks', () => {
      const onContinue = vi.fn()
      const onSaveToCloud = vi.fn()
      const onDelete = vi.fn()
      const draft = createDraft({ id: 'custom-draft-id' })

      render(
        <DraftCard
          draft={draft}
          onContinue={onContinue}
          onSaveToCloud={onSaveToCloud}
          onDelete={onDelete}
        />,
      )

      fireEvent.click(screen.getByText('Continue'))
      fireEvent.click(screen.getByText('Save to Cloud'))
      fireEvent.click(screen.getByTitle('Delete draft'))

      expect(onContinue).toHaveBeenCalledWith('custom-draft-id')
      expect(onSaveToCloud).toHaveBeenCalledWith('custom-draft-id')
      expect(onDelete).toHaveBeenCalledWith('custom-draft-id')
    })
  })
})
