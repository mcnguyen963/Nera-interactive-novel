import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChapterDivider } from './ChapterDivider'

describe('ChapterDivider', () => {
  describe('renders chapter title', () => {
    it('displays the chapter title', () => {
      render(<ChapterDivider title="Chapter I" onTitleChange={vi.fn()} />)

      expect(screen.getByText('Chapter I')).toBeDefined()
    })

    it('does not show input when not editing', () => {
      render(<ChapterDivider title="Chapter I" onTitleChange={vi.fn()} />)

      expect(screen.queryByRole('textbox')).toBeNull()
    })
  })

  describe('editing mode', () => {
    it('click enables editing', () => {
      render(<ChapterDivider title="Chapter I" onTitleChange={vi.fn()} />)

      fireEvent.click(screen.getByText('Chapter I'))

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input).toBeDefined()
      expect(input.value).toBe('Chapter I')
    })

    it('click on span enters edit mode', () => {
      render(<ChapterDivider title="Prologue" onTitleChange={vi.fn()} />)

      fireEvent.click(screen.getByText('Prologue'))

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('Prologue')
    })
  })

  describe('handleBlur', () => {
    it('saves when text differs from original', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Chapter One' } })
      fireEvent.blur(input)

      expect(onTitleChange).toHaveBeenCalledWith('Chapter One')
    })

    it('saves trimmed value when text has surrounding whitespace', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: '  Chapter One  ' } })
      fireEvent.blur(input)

      expect(onTitleChange).toHaveBeenCalledWith('Chapter One')
    })

    it('reverts when text is unchanged', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Chapter I' } })
      fireEvent.blur(input)

      expect(onTitleChange).not.toHaveBeenCalled()
    })

    it('reverts when text is empty', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.blur(input)

      expect(onTitleChange).not.toHaveBeenCalled()
    })

    it('reverts when text is only whitespace', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.blur(input)

      expect(onTitleChange).not.toHaveBeenCalled()
    })

    it('displays original title after revert', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.blur(input)

      expect(screen.getByText('Chapter I')).toBeDefined()
    })
  })

  describe('keyboard interaction', () => {
    it('Enter key triggers blur and saves changes', async () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      await userEvent.clear(input)
      await userEvent.type(input, 'Chapter One{Enter}')

      expect(onTitleChange).toHaveBeenCalledWith('Chapter One')
    })

    it('Enter key reverts when text is empty', () => {
      const onTitleChange = vi.fn()

      render(<ChapterDivider title="Chapter I" onTitleChange={onTitleChange} />)

      fireEvent.click(screen.getByText('Chapter I'))
      const input = screen.getByRole('textbox') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onTitleChange).not.toHaveBeenCalled()
    })
  })
})
