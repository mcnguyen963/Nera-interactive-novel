import { create } from 'zustand'

interface Toast {
  id: string
  message: string
  type: 'info' | 'error' | 'success'
}

interface UiState {
  toasts: Toast[]
  showSettings: boolean
  showImageModal: boolean
  imageModalTitle: string
  imageModalPrompt: string
  imageModalUrl: string | null
  isGeneratingImage: boolean

  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  openSettings: () => void
  closeSettings: () => void
  openImageModal: (title: string, prompt: string, url?: string | null) => void
  closeImageModal: () => void
  setGeneratingImage: (val: boolean) => void
  setImageModalUrl: (url: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  showSettings: false,
  showImageModal: false,
  imageModalTitle: '',
  imageModalPrompt: '',
  imageModalUrl: null,
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
  openImageModal: (title, prompt, url = null) =>
    set({ showImageModal: true, imageModalTitle: title, imageModalPrompt: prompt, imageModalUrl: url }),
  closeImageModal: () => set({ showImageModal: false, imageModalUrl: null }),
  setGeneratingImage: (val) => set({ isGeneratingImage: val }),
  setImageModalUrl: (url) => set({ imageModalUrl: url }),
}))
