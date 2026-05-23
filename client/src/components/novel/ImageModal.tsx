import { useState } from 'react'
import { useUiStore, useStoryStore, useSettingsStore } from '../../stores'
import { generateImage, simpleChat } from '../../lib/edgeApi'
import { buildKVContext } from '../../lib/utils'
import { Modal, Button, Spinner } from '../shared'

export function ImageModal() {
  const {
    showImageModal,
    imageModalTitle,
    imageModalPrompt,
    imageModalTargetChapterIndex,
    imageModalTargetParagraphIndex,
    closeImageModal,
    isGeneratingImage,
    setGeneratingImage,
    setImageModalPrompt,
    addToast,
  } = useUiStore()

  const image = useSettingsStore((s) => s.image)
  const llm = useSettingsStore((s) => s.llm)

  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedDesc, setGeneratedDesc] = useState('')
  const [isGeneratingPrompt, setGeneratingPrompt] = useState(false)

  async function handleGenerate() {
    if (!imageModalPrompt) return
    setGeneratingImage(true)
    setGeneratedUrl(null)
    setGeneratedDesc('')
    try {
      const res = await generateImage(imageModalPrompt, image.provider, image.model, llm.localUrl, llm.localModel, image.localUrl, image.comfyWorkflow, llm.apiKey)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const imageUrl = data.url || ''
      const description = data.description || ''
      if (imageUrl) {
        setGeneratedUrl(imageUrl)
        setGeneratedDesc(description)
      } else if (description) {
        setGeneratedDesc(description)
      }
      if (imageUrl || description) {
        addToast('Image generated', 'success')
      } else {
        addToast('Nothing was generated — check your image provider settings', 'error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image generation failed'
      addToast(msg, 'error')
    } finally {
      setGeneratingImage(false)
    }
  }

  async function handleWritePrompt() {
    const { story, chapters } = useStoryStore.getState()
    if (!story) return
    setGeneratingPrompt(true)
    try {
      const allParas = chapters.flatMap((c) => c.paragraphs)
      const llmSettings = useSettingsStore.getState().llm
      const ctx = buildKVContext(story.scenario, allParas, llmSettings.contextWindow)
      const systemPrompt = 'You are an expert at writing detailed prompts for image generation. Based on the story context, write a vivid, detailed image prompt. Focus on: visual details (character appearance, environment, lighting, colors), composition, mood/atmosphere, and style. Output only the prompt — no explanations, no meta-commentary. Keep it to 1-3 descriptive sentences.'
      const userMessage = `Write an image generation prompt for: ${imageModalTitle}\n\nStory context:\n${ctx}`

      setImageModalPrompt('')
      
      const text = await simpleChat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        llmSettings.provider,
        llmSettings.provider === 'openrouter' ? llmSettings.openrouterModel : llmSettings.localModel,
        0.8,
        undefined,
        llmSettings.localUrl,
        llmSettings.apiKey,
      )

      if (text) {
        setImageModalPrompt(text)
      } else {
        addToast('LLM returned empty response', 'error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate prompt'
      addToast(msg, 'error')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  function handleAddToNovel() {
    const { addImageToParagraph } = useStoryStore.getState()
    const chapterIdx = imageModalTargetChapterIndex
    const paras = useStoryStore.getState().chapters[chapterIdx]?.paragraphs
    if (!paras || paras.length === 0) {
      addToast('No paragraphs available to add image to', 'error')
      return
    }
    const paraIdx = imageModalTargetParagraphIndex ?? paras.length - 1
    addImageToParagraph(chapterIdx, paraIdx, generatedUrl || '', generatedDesc)
    addToast('Image added to paragraph', 'success')
    closeImageModal()
  }

  const hasResult = !!(generatedUrl || generatedDesc)

  return (
    <Modal open={showImageModal} onClose={closeImageModal} className="w-[560px]">
      <div className="flex justify-between items-center mb-3.5">
        <span className="font-[var(--font-head)] text-[0.9rem] tracking-[0.15em] text-[var(--accent)] border-none p-0">
          {imageModalTitle || 'Generated Image'}
        </span>
        <Button onClick={closeImageModal}>✕</Button>
      </div>

      <textarea
        className="w-full text-[0.85rem] text-[var(--ink2)] leading-[1.5] p-3 bg-[var(--bg)] rounded-[var(--r)] mb-3 border border-[var(--rule)] resize-y min-h-[4rem]"
        value={imageModalPrompt}
        onChange={(e) => setImageModalPrompt(e.target.value)}
        placeholder="Enter an image generation prompt..."
        rows={3}
      />

      <div className="text-center text-[var(--ink3)] italic py-5">
        {isGeneratingImage ? (
          <div className="flex items-center justify-center gap-2">
            <Spinner />
            Generating…
          </div>
        ) : generatedUrl ? (
          <img src={generatedUrl} alt="Generated" className="w-full h-auto rounded-[var(--r)]" />
        ) : generatedDesc ? (
          <p className="text-[0.85rem] leading-[1.6] text-[var(--ink2)] not-italic">
            {generatedDesc}
          </p>
        ) : (
          'Click generate to create an image.'
        )}
      </div>

      <div className="flex gap-2 justify-end mt-3">
        <Button onClick={handleWritePrompt} disabled={isGeneratingImage || isGeneratingPrompt}>
          {isGeneratingPrompt ? 'Writing prompt…' : '✏️ Write from story'}
        </Button>
        <Button onClick={handleGenerate} disabled={isGeneratingImage || isGeneratingPrompt}>
          {isGeneratingImage ? 'Generating…' : 'Generate'}
        </Button>
        {hasResult && (
          <Button onClick={handleAddToNovel}>
            Add to Novel
          </Button>
        )}
        <Button onClick={closeImageModal}>Close</Button>
      </div>
    </Modal>
  )
}
