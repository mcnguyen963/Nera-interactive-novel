import { create } from 'zustand'

interface Toast {
  id: string
  message: string
  type: 'info' | 'error' | 'success'
}

interface UiState {
  toasts: Toast[]
  showSettings: boolean
  showAccountSettings: boolean
  showImageModal: boolean
  imageModalTitle: string
  imageModalPrompt: string
  imageModalUrl: string | null
  imageModalTargetChapterIndex: number
  imageModalTargetParagraphIndex: number | null
  isGeneratingImage: boolean

  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  openSettings: () => void
  closeSettings: () => void
  openAccountSettings: () => void
  closeAccountSettings: () => void
  openImageModal: (title: string, prompt: string, url?: string | null, targetChapterIndex?: number, targetParagraphIndex?: number | null) => void
  closeImageModal: () => void
  setGeneratingImage: (val: boolean) => void
  setImageModalUrl: (url: string | null) => void
  setImageModalPrompt: (prompt: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  showSettings: false,
  showAccountSettings: false,
  showImageModal: false,
  imageModalTitle: '',
  imageModalPrompt: '',
  imageModalUrl: null,
  imageModalTargetChapterIndex: 0,
  imageModalTargetParagraphIndex: null,
  isGeneratingImage: false,

  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 2800)
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  openAccountSettings: () => set({ showAccountSettings: true }),
  closeAccountSettings: () => set({ showAccountSettings: false }),
  openImageModal: (title, prompt, url = null, targetChapterIndex = 0, targetParagraphIndex = null) =>
    set({ showImageModal: true, imageModalTitle: title, imageModalPrompt: prompt, imageModalUrl: url, imageModalTargetChapterIndex: targetChapterIndex, imageModalTargetParagraphIndex: targetParagraphIndex }),
  closeImageModal: () => set({ showImageModal: false, imageModalUrl: null, imageModalTargetParagraphIndex: null }),
  setGeneratingImage: (val) => set({ isGeneratingImage: val }),
  setImageModalUrl: (url) => set({ imageModalUrl: url }),
  setImageModalPrompt: (prompt) => set({ imageModalPrompt: prompt }),
}))
