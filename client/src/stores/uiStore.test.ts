import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUiStore } from './uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUiStore.setState({
      toasts: [],
      showSettings: false,
      showImageModal: false,
      imageModalTitle: '',
      imageModalPrompt: '',
      imageModalUrl: null,
      isGeneratingImage: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('toasts', () => {
    it('starts empty', () => {
      expect(useUiStore.getState().toasts).toEqual([])
    })

    it('adds a toast', () => {
      useUiStore.getState().addToast('Hello')
      const toasts = useUiStore.getState().toasts
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('Hello')
      expect(toasts[0].type).toBe('info')
    })

    it('adds a toast with custom type', () => {
      useUiStore.getState().addToast('Error!', 'error')
      expect(useUiStore.getState().toasts[0].type).toBe('error')
    })

    it('removes a toast by id', () => {
      useUiStore.getState().addToast('Toast 1')
      useUiStore.getState().addToast('Toast 2')
      const toasts = useUiStore.getState().toasts
      const id = toasts[0].id
      useUiStore.getState().removeToast(id)
      expect(useUiStore.getState().toasts).toHaveLength(1)
      expect(useUiStore.getState().toasts.find((t) => t.id === id)).toBeUndefined()
    })
  })

  describe('settings', () => {
    it('starts closed', () => {
      expect(useUiStore.getState().showSettings).toBe(false)
    })

    it('opens and closes', () => {
      useUiStore.getState().openSettings()
      expect(useUiStore.getState().showSettings).toBe(true)
      useUiStore.getState().closeSettings()
      expect(useUiStore.getState().showSettings).toBe(false)
    })
  })

  describe('image modal', () => {
    it('starts closed', () => {
      expect(useUiStore.getState().showImageModal).toBe(false)
    })

    it('opens with title, prompt, and url', () => {
      useUiStore.getState().openImageModal('My Title', 'A prompt', 'http://img.url')
      expect(useUiStore.getState().showImageModal).toBe(true)
      expect(useUiStore.getState().imageModalTitle).toBe('My Title')
      expect(useUiStore.getState().imageModalPrompt).toBe('A prompt')
      expect(useUiStore.getState().imageModalUrl).toBe('http://img.url')
    })

    it('opens with default null url', () => {
      useUiStore.getState().openImageModal('Title', 'Prompt')
      expect(useUiStore.getState().imageModalUrl).toBeNull()
    })

    it('closes and clears url', () => {
      useUiStore.getState().openImageModal('T', 'P', 'url')
      useUiStore.getState().closeImageModal()
      expect(useUiStore.getState().showImageModal).toBe(false)
      expect(useUiStore.getState().imageModalUrl).toBeNull()
    })

    it('sets generating flag', () => {
      useUiStore.getState().setGeneratingImage(true)
      expect(useUiStore.getState().isGeneratingImage).toBe(true)
      useUiStore.getState().setGeneratingImage(false)
      expect(useUiStore.getState().isGeneratingImage).toBe(false)
    })

    it('sets image modal url', () => {
      useUiStore.getState().setImageModalUrl('http://example.com/img.png')
      expect(useUiStore.getState().imageModalUrl).toBe('http://example.com/img.png')
    })
  })
})
