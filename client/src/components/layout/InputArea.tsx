import { useState, useMemo, type KeyboardEvent } from 'react'
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
    if (!story || isGenerating) return
    setInput('')

    const allParas = chapters.flatMap((c) => c.paragraphs)
    const kvCtx = buildKVContext(story.scenario, allParas, llm.contextWindow)
    const fullSystem = llm.systemPrompt + '\n\n## Story Context (Key-Value)\n' + kvCtx

    let userMessage: string
    if (raw) {
      userMessage = `Rewrite the following action as vivid story narrative and continue the story naturally, weaving it into the prose: "${raw}"\n\nWrite the next paragraphs of the story.`
    } else {
      userMessage = `Continue the story naturally, writing the next paragraphs of the narrative.`
    }

    const messages = [
      { role: 'system', content: fullSystem },
      { role: 'user', content: userMessage },
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
          localUrl: llm.localUrl,
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

  const ctxSize = useMemo(() => {
    if (!story) return 0
    const paras = chapters.flatMap((c) => c.paragraphs)
    const kv = buildKVContext(story.scenario, paras, llm.contextWindow)
    return (llm.systemPrompt + '\n\n## Story Context (Key-Value)\n' + kv).length
  }, [story, chapters, llm.systemPrompt, llm.contextWindow])

  if (!story) return null

  return (
    <div className="mt-10 pb-4">
      <div className="bg-[var(--page)] border border-[var(--rule)] rounded-md p-3 flex flex-col gap-2 shadow-[0_2px_16px_rgba(0,0,0,0.08)]">
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isGenerating ? 'Writing…' : 'What do you do…'}
          rows={1}
          disabled={isGenerating}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[0.75rem] text-[var(--ink3)]">
              Enter to send · Shift+Enter for new line
            </span>
            <span className="text-[0.7rem] text-[var(--ink3)] opacity-50">
              ~{Math.round(ctxSize / 4).toLocaleString()} tokens
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button variant="primary" onClick={handleSend} disabled={isGenerating}>
              {isGenerating ? '…' : 'Continue →'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
