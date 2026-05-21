import { useUiStore, useStoryStore } from '../../stores'
import { generateImage } from '../../lib/edgeApi'
import { Modal, Button, Spinner } from '../shared'

export function ImageModal() {
  const {
    showImageModal,
    imageModalTitle,
    imageModalPrompt,
    imageModalUrl,
    closeImageModal,
    isGeneratingImage,
    setGeneratingImage,
    addToast,
  } = useUiStore()

  async function handleGenerate() {
    if (!imageModalPrompt) return
    setGeneratingImage(true)
    try {
      const res = await generateImage(imageModalPrompt, 'cloud', 'flux')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const imageUrl = data.data?.[0]?.url || data.images?.[0] || ''
      if (imageUrl) {
        const { addImageToParagraph } = useStoryStore.getState()
        const { activeChapterIndex } = useStoryStore.getState()
        const { setImageModalUrl } = useUiStore.getState()
        setImageModalUrl(imageUrl)
        const paras = useStoryStore.getState().chapters[activeChapterIndex]?.paragraphs
        if (paras && paras.length > 0) {
          addImageToParagraph(activeChapterIndex, paras.length - 1, imageUrl)
        }
      }
      addToast('Image generated', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image generation failed'
      addToast(msg, 'error')
    } finally {
      setGeneratingImage(false)
    }
  }

  return (
    <Modal open={showImageModal} onClose={closeImageModal} className="w-[560px]">
      <div className="flex justify-between items-center mb-3.5">
        <span className="font-[var(--font-head)] text-[0.9rem] tracking-[0.15em] text-[var(--accent)] border-none p-0">
          {imageModalTitle || 'Generated Image'}
        </span>
        <Button onClick={closeImageModal}>✕</Button>
      </div>

      {imageModalPrompt && (
        <div className="text-[0.85rem] text-[var(--ink2)] italic leading-[1.5] p-3 bg-[var(--bg)] rounded-[var(--r)] mb-3">
          {imageModalPrompt}
        </div>
      )}

      <div className="text-center text-[var(--ink3)] italic py-5">
        {isGeneratingImage ? (
          <div className="flex items-center justify-center gap-2">
            <Spinner />
            Generating…
          </div>
        ) : imageModalUrl ? (
          <img src={imageModalUrl} alt="Generated" className="w-full h-auto rounded-[var(--r)]" />
        ) : (
          'Click generate to create an image.'
        )}
      </div>

      <div className="flex gap-2 justify-end mt-3">
        <Button onClick={handleGenerate} disabled={isGeneratingImage}>
          {isGeneratingImage ? 'Generating…' : 'Generate'}
        </Button>
        <Button onClick={closeImageModal}>Close</Button>
      </div>
    </Modal>
  )
}
