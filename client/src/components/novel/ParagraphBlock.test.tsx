import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Paragraph as ParagraphType } from '../../types/story'

const mockStoryStoreState = vi.hoisted(() => ({
  regeneratingParagraphId: null as string | null,
  updateParagraph: vi.fn(),
  deleteParagraph: vi.fn(),
  regenerateParagraph: vi.fn(),
}))

const mockUiStoreState = vi.hoisted(() => ({
  openImageModal: vi.fn(),
}))

vi.mock('../../stores', () => ({
  useStoryStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state: Record<string, unknown> = {
      regeneratingParagraphId: mockStoryStoreState.regeneratingParagraphId,
      updateParagraph: mockStoryStoreState.updateParagraph,
      deleteParagraph: mockStoryStoreState.deleteParagraph,
      regenerateParagraph: mockStoryStoreState.regenerateParagraph,
    }
    return selector ? selector(state) : state
  }),
  useUiStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state: Record<string, unknown> = {
      openImageModal: mockUiStoreState.openImageModal,
    }
    return selector ? selector(state) : state
  }),
}))

import { ParagraphBlock } from './ParagraphBlock'

const baseParagraph: ParagraphType = {
  id: 'para-1',
  text: 'The sun set over the horizon.',
  role: 'narrator',
  images: [],
  imageDescriptions: [],
  order: 0,
}

function renderParagraph(
  overrides?: Partial<ParagraphType>,
  chapterIndex = 0,
  paragraphIndex = 0,
) {
  const paragraph = { ...baseParagraph, ...overrides }
  return render(
    <ParagraphBlock
      chapterIndex={chapterIndex}
      paragraphIndex={paragraphIndex}
      paragraph={paragraph}
    />,
  )
}

describe('ParagraphBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoryStoreState.regeneratingParagraphId = null
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      value: 100,
      configurable: true,
      writable: true,
    })
  })

  // =========================================================================
  // UNIT TESTS - handleBlur
  // =========================================================================

  describe('handleBlur', () => {
    it('saves changes when text differs from original', () => {
      renderParagraph()
      const p = screen.getByText('The sun set over the horizon.')
      fireEvent.doubleClick(p)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Changed text' } })
      fireEvent.blur(textarea)

      expect(mockStoryStoreState.updateParagraph).toHaveBeenCalledWith(0, 0, 'Changed text')
    })

    it('discards changes when text is unchanged', () => {
      renderParagraph()
      const p = screen.getByText('The sun set over the horizon.')
      fireEvent.doubleClick(p)

      const textarea = screen.getByRole('textbox')
      fireEvent.blur(textarea)

      expect(mockStoryStoreState.updateParagraph).not.toHaveBeenCalled()
    })

    it('discards changes when text is empty', () => {
      renderParagraph()
      const p = screen.getByText('The sun set over the horizon.')
      fireEvent.doubleClick(p)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: '' } })
      fireEvent.blur(textarea)

      expect(mockStoryStoreState.updateParagraph).not.toHaveBeenCalled()
    })

    it('resets editing state on Escape key', () => {
      renderParagraph()
      const p = screen.getByText('The sun set over the horizon.')
      fireEvent.doubleClick(p)

      const textarea = screen.getByRole('textbox')
      fireEvent.keyDown(textarea, { key: 'Escape' })

      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByText('The sun set over the horizon.')).toBeDefined()
    })
  })

  // =========================================================================
  // UNIT TESTS - Regeneration state
  // =========================================================================

  describe('regeneration state', () => {
    it('shows spinner when paragraph is being regenerated', () => {
      mockStoryStoreState.regeneratingParagraphId = 'para-1'
      renderParagraph()

      expect(screen.getByText('Regenerating…')).toBeDefined()
      expect(screen.queryByRole('textbox')).toBeNull()
    })

    it('hides paragraph text during regeneration', () => {
      mockStoryStoreState.regeneratingParagraphId = 'para-1'
      renderParagraph()

      expect(screen.queryByText('The sun set over the horizon.')).toBeNull()
    })

    it('stops showing spinner when paragraph is no longer regenerating', () => {
      mockStoryStoreState.regeneratingParagraphId = 'other-para'
      renderParagraph()

      expect(screen.queryByText('Regenerating…')).toBeNull()
      expect(screen.getByText('The sun set over the horizon.')).toBeDefined()
    })
  })

  // =========================================================================
  // UNIT TESTS - Images rendering
  // =========================================================================

  describe('images', () => {
    it('renders images with descriptions', () => {
      renderParagraph({
        images: ['http://example.com/sunset.png'],
        imageDescriptions: ['A beautiful sunset over the ocean'],
      })

      const img = screen.getByRole('img')
      expect(img).toBeDefined()
      expect(img.getAttribute('src')).toBe('http://example.com/sunset.png')
      expect(screen.getByText('A beautiful sunset over the ocean')).toBeDefined()
    })

    it('renders images without descriptions', () => {
      renderParagraph({
        images: ['http://example.com/img.png'],
        imageDescriptions: [],
      })

      const img = screen.getByRole('img')
      expect(img).toBeDefined()
      expect(img.getAttribute('alt')).toBe('Generated')
    })

    it('renders multiple images', () => {
      renderParagraph({
        images: ['http://example.com/1.png', 'http://example.com/2.png'],
        imageDescriptions: ['First scene', 'Second scene'],
      })

      const imgs = screen.getAllByRole('img')
      expect(imgs).toHaveLength(2)
    })

    it('renders image descriptions without images', () => {
      renderParagraph({
        images: [],
        imageDescriptions: ['A scene with no image yet'],
      })

      expect(screen.getByText('A scene with no image yet')).toBeDefined()
    })

    it('skips rendering for empty image URLs', () => {
      renderParagraph({
        images: [''],
        imageDescriptions: [''],
      })

      const imgs = screen.queryAllByRole('img')
      expect(imgs).toHaveLength(0)
    })
  })

  // =========================================================================
  // UNIT TESTS - Action buttons
  // =========================================================================

  describe('action buttons', () => {
    it('calls deleteParagraph when delete button is clicked', () => {
      renderParagraph()
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('del'))

      expect(mockStoryStoreState.deleteParagraph).toHaveBeenCalledWith(0, 0)
    })

    it('calls regenerateParagraph when regen button is clicked (narrator)', () => {
      renderParagraph({ role: 'narrator' })
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('regen'))

      expect(mockStoryStoreState.regenerateParagraph).toHaveBeenCalledWith(0, 0)
    })

    it('does not render regen button for player paragraphs', () => {
      renderParagraph({ role: 'player' })
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      expect(screen.queryByText('regen')).toBeNull()
    })

    it('calls openImageModal when add image button is clicked', () => {
      renderParagraph()
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('add image'))

      expect(mockUiStoreState.openImageModal).toHaveBeenCalledWith(
        'Add Image',
        'The sun set over the horizon.',
        null,
        0,
        0,
      )
    })

    it('disables regen button during regeneration', () => {
      mockStoryStoreState.regeneratingParagraphId = 'para-1'
      renderParagraph({ role: 'narrator' })
      fireEvent.mouseEnter(screen.getByText('Regenerating…').closest('.group')!)

      const regenBtn = screen.getByText('regen') as HTMLButtonElement
      expect(regenBtn.disabled).toBe(true)
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Edit flow
  // =========================================================================

  describe('integration - edit flow', () => {
    it('double-click enters edit mode with original text', () => {
      renderParagraph()

      fireEvent.doubleClick(screen.getByText('The sun set over the horizon.'))

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea).toBeDefined()
      expect(textarea.value).toBe('The sun set over the horizon.')
    })

    it('edit button enters edit mode', () => {
      renderParagraph()
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('edit'))

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('The sun set over the horizon.')
    })

    it('type new text and blur updates story store', async () => {
      renderParagraph()
      const p = screen.getByText('The sun set over the horizon.')
      fireEvent.doubleClick(p)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      await userEvent.clear(textarea)
      await userEvent.type(textarea, 'The moon rose over the mountains.')
      fireEvent.blur(textarea)

      expect(mockStoryStoreState.updateParagraph).toHaveBeenCalledWith(
        0,
        0,
        'The moon rose over the mountains.',
      )
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Delete flow
  // =========================================================================

  describe('integration - delete flow', () => {
    it('clicking delete removes paragraph from store', () => {
      renderParagraph()
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('del'))

      expect(mockStoryStoreState.deleteParagraph).toHaveBeenCalledWith(0, 0)
    })

    it('delete is always available regardless of paragraph role', () => {
      renderParagraph({ role: 'player' })
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      expect(screen.getByText('del')).toBeDefined()
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Regenerate flow
  // =========================================================================

  describe('integration - regenerate flow', () => {
    it('clicking regen triggers store regeneration', () => {
      renderParagraph({ role: 'narrator' })
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('regen'))

      expect(mockStoryStoreState.regenerateParagraph).toHaveBeenCalledWith(0, 0)
    })

    it('regenerating state disables duplicate regen clicks', () => {
      mockStoryStoreState.regeneratingParagraphId = 'para-1'
      renderParagraph({ role: 'narrator' })
      fireEvent.mouseEnter(screen.getByText('Regenerating…').closest('.group')!)

      const regenBtn = screen.getByText('regen') as HTMLButtonElement
      expect(regenBtn.disabled).toBe(true)
    })
  })

  // =========================================================================
  // INTEGRATION TESTS - Add image flow
  // =========================================================================

  describe('integration - add image flow', () => {
    it('clicking add image opens modal with paragraph text and indices', () => {
      renderParagraph()
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('add image'))

      expect(mockUiStoreState.openImageModal).toHaveBeenCalledTimes(1)
      expect(mockUiStoreState.openImageModal).toHaveBeenCalledWith(
        'Add Image',
        'The sun set over the horizon.',
        null,
        0,
        0,
      )
    })

    it('add image button is present for all paragraph roles', () => {
      renderParagraph({ role: 'player' })
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      expect(screen.getByText('add image')).toBeDefined()
    })
  })

  // =========================================================================
  // SYSTEM / COMPONENT TESTS - Paragraph display
  // =========================================================================

  describe('system - paragraph display', () => {
    it('renders narrator paragraph with correct text content', () => {
      renderParagraph({ role: 'narrator' })

      const p = screen.getByText('The sun set over the horizon.')
      expect(p).toBeDefined()
      expect(p.tagName).toBe('P')
    })

    it('renders player paragraph with italic styling', () => {
      renderParagraph({ role: 'player' })

      const p = screen.getByText('The sun set over the horizon.')
      expect(p.className).toContain('italic')
    })

    it('renders image when present', () => {
      renderParagraph({
        images: ['http://example.com/img.png'],
        imageDescriptions: ['An image'],
      })

      expect(screen.getByRole('img')).toBeDefined()
      expect(screen.getByText('An image')).toBeDefined()
    })

    it('shows editing UI when in edit mode', () => {
      const { container } = render(
        <ParagraphBlock
          chapterIndex={0}
          paragraphIndex={0}
          paragraph={baseParagraph}
        />,
      )
      fireEvent.doubleClick(screen.getByText('The sun set over the horizon.'))

      expect(screen.getByRole('textbox')).toBeDefined()
      expect(container.querySelectorAll('p')).toHaveLength(0)
    })

    it('shows action buttons for non-generating state on hover', () => {
      renderParagraph()
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      expect(screen.getByText('edit')).toBeDefined()
      expect(screen.getByText('add image')).toBeDefined()
      expect(screen.getByText('del')).toBeDefined()
    })

    it('narrator paragraphs show regen button on hover', () => {
      renderParagraph({ role: 'narrator' })
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      expect(screen.getByText('regen')).toBeDefined()
    })
  })

  // =========================================================================
  // SYSTEM / COMPONENT TESTS - Regeneration overlay
  // =========================================================================

  describe('system - regeneration overlay', () => {
    it('replaces paragraph content with spinner during regeneration', () => {
      mockStoryStoreState.regeneratingParagraphId = 'para-1'
      renderParagraph()

      expect(screen.getByText('Regenerating…')).toBeDefined()
      const spinnerSpan = document.querySelector('.animate-spin')
      expect(spinnerSpan).not.toBeNull()
    })

    it('paragraph text returns after regeneration completes', () => {
      mockStoryStoreState.regeneratingParagraphId = null
      renderParagraph()

      expect(screen.getByText('The sun set over the horizon.')).toBeDefined()
      expect(screen.queryByText('Regenerating…')).toBeNull()
    })
  })

  // =========================================================================
  // SYSTEM / COMPONENT TESTS - Edge cases
  // =========================================================================

  describe('system - edge cases', () => {
    it('handles different chapter and paragraph indices', () => {
      renderParagraph({}, 2, 5)
      fireEvent.mouseEnter(screen.getByText('The sun set over the horizon.').closest('.group')!)

      fireEvent.click(screen.getByText('del'))
      expect(mockStoryStoreState.deleteParagraph).toHaveBeenCalledWith(2, 5)
    })

    it('handles paragraph with all optional fields empty', () => {
      renderParagraph({
        id: 'empty-para',
        text: 'Just text.',
        role: 'narrator',
        images: [],
        imageDescriptions: [],
        order: 0,
      })

      expect(screen.getByText('Just text.')).toBeDefined()
    })

    it('maintains paragraph text display after blur without changes', () => {
      renderParagraph()
      fireEvent.doubleClick(screen.getByText('The sun set over the horizon.'))
      const textarea = screen.getByRole('textbox')
      fireEvent.blur(textarea)

      expect(screen.getByText('The sun set over the horizon.')).toBeDefined()
    })
  })
})
