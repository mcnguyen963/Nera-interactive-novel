import { useState, type KeyboardEvent } from 'react'
import { useStoryStore, useSettingsStore, useUiStore } from '../../stores'
import { streamLlmChat } from '../../lib/edgeApi'
import { buildKVContext } from '../../lib/utils'
import { Button, TextArea } from '../shared'

export function InputArea() {
  const [input, setInput] = useState('')
  const { story, chapters, activeChapterIndex, isGenerating, addParagraph, setGenerating } = useStoryStore()
  const llm = useSettingsStore((s) => s.llm)
  const addToast = useUiStore((s) => s.addToast)

  async function handleSend() {
    const raw = input.trim()
    if (!raw || !story || isGenerating) return
    setInput('')

    addParagraph(activeChapterIndex, raw, 'player')

    const allParas = chapters.flatMap((c) => c.paragraphs)
    const kvCtx = buildKVContext(story.scenario, allParas.slice(-llm.contextWindow))
    const fullSystem = llm.systemPrompt + '\n\n## Story Context (Key-Value)\n' + kvCtx
    const messages = [
      { role: 'system', content: fullSystem },
      { role: 'user', content: `My action: ${raw}. Write the next paragraphs of the story.` },
    ]

    setGenerating(true)
    let fullText = ''
    let paragraphIndex = -1
    try {
      await streamLlmChat(
        {
          messages,
          provider: llm.provider,
          model: llm.provider === 'openrouter' ? llm.openrouterModel : llm.localModel,
          temperature: llm.temperature,
          maxTokens: llm.maxTokens,
        },
        (chunk) => {
          if (!fullText && chunk.trim()) {
            addParagraph(activeChapterIndex, chunk, 'narrator')
            const store = useStoryStore.getState()
            const ch = store.chapters[activeChapterIndex]
            paragraphIndex = ch.paragraphs.length - 1
          } else if (paragraphIndex >= 0) {
            const store = useStoryStore.getState()
            const ch = store.chapters[activeChapterIndex]
            if (ch && ch.paragraphs[paragraphIndex]) {
              const currentText = ch.paragraphs[paragraphIndex].text
              store.updateParagraph(activeChapterIndex, paragraphIndex, currentText + chunk)
            }
          }
          fullText += chunk
        },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      addToast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!story) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)_28%] to-transparent pb-5 pt-7 flex justify-center z-40">
      <div className="w-full max-w-[600px] bg-[var(--page)] border border-[var(--rule)] rounded-md p-3 flex flex-col gap-2 shadow-[0_2px_16px_rgba(0,0,0,0.08)]">
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="What do you do…"
          rows={1}
          disabled={isGenerating}
        />
        <div className="flex items-center justify-between">
          <span className="text-[0.75rem] text-[var(--ink3)]">
            Enter to send · Shift+Enter for new line
          </span>
          <div className="flex gap-1.5">
            <Button variant="primary" onClick={handleSend} disabled={isGenerating || !input.trim()}>
              {isGenerating ? '…' : 'Continue →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
