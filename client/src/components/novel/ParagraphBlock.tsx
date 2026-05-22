import { useState, useEffect, useRef } from 'react'
import { useStoryStore, useUiStore } from '../../stores'
import { Spinner } from '../shared'
import type { Paragraph as ParagraphType } from '../../types/story'

interface ParagraphBlockProps {
  chapterIndex: number
  paragraphIndex: number
  paragraph: ParagraphType
}

export function ParagraphBlock({ chapterIndex, paragraphIndex, paragraph }: ParagraphBlockProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(paragraph.text)
  const [showActions, setShowActions] = useState(false)
  const isRegenerating = useStoryStore((s) => s.regeneratingParagraphId === paragraph.id)
  const { updateParagraph, deleteParagraph, regenerateParagraph } = useStoryStore()
  const { openImageModal } = useUiStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditText(paragraph.text)
  }, [paragraph.text])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editing, editText])

  function handleBlur() {
    setEditing(false)
    if (editText.trim() && editText !== paragraph.text) {
      updateParagraph(chapterIndex, paragraphIndex, editText.trim())
    }
  }

  return (
    <div
      className="relative mb-1 group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {isRegenerating ? (
        <div className="flex items-center gap-2 py-2 text-[var(--ink3)] text-[0.85rem]">
          <Spinner />
          Regenerating…
        </div>
      ) : editing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Escape') handleBlur() }}
          autoFocus
          className="w-full bg-[var(--highlight)] outline-[1.5px] outline-[var(--accent)] rounded-[2px] py-1.5 px-1 text-[var(--ink)] font-[var(--font-body)] text-[1rem] leading-[1.85] resize-none"
        />
      ) : (
        <p
          onDoubleClick={() => { setEditing(true); setEditText(paragraph.text) }}
          className={`text-[1rem] leading-[1.85] py-1.5 outline-none rounded-[2px] transition-[background] duration-100 whitespace-pre-wrap break-words ${
            paragraph.role === 'player'
              ? 'italic text-[#3a2a10] before:content-["\\2761\\00a0"] before:not-italic before:text-[var(--accent)] before:opacity-70'
              : 'text-[var(--ink)]'
          }`}
        >
          {paragraph.text}
        </p>
      )}

      {paragraph.images?.length > 0 && (
        <div className="flex flex-col gap-2 my-2">
          {paragraph.images.map((url, i) => (
            url ? (
              <div key={i} className="flex flex-col gap-0.5">
                <img src={url} alt={paragraph.imageDescriptions?.[i] || 'Generated'} className="max-w-[200px] rounded-[var(--r)]" />
                {paragraph.imageDescriptions?.[i] && (
                  <p className="text-[0.78rem] leading-[1.5] text-[var(--ink3)] italic">
                    {paragraph.imageDescriptions[i]}
                  </p>
                )}
              </div>
            ) : null
          ))}
        </div>
      )}
      {paragraph.imageDescriptions?.length > 0 && (
        <div className="flex flex-col gap-1 my-2">
          {paragraph.imageDescriptions.map((desc, i) => (
            desc && !paragraph.images[i] ? (
              <p key={i} className="text-[0.78rem] leading-[1.5] text-[var(--ink3)] italic py-1">
                {desc}
              </p>
            ) : null
          ))}
        </div>
      )}

      <div
        className={`absolute right-[-88px] top-[3px] flex flex-col gap-[3px] transition-opacity duration-150 ${
          showActions ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={() => { setEditing(true); setEditText(paragraph.text) }}
          className="bg-[var(--page)] border border-[var(--rule)] text-[var(--ink3)] text-[0.68rem] px-[7px] py-[2px] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] whitespace-nowrap transition-all duration-120 hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          edit
        </button>
        {paragraph.role === 'narrator' && (
          <button
            onClick={() => regenerateParagraph(chapterIndex, paragraphIndex)}
            disabled={isRegenerating}
            className="bg-[var(--page)] border border-[var(--rule)] text-[var(--ink3)] text-[0.68rem] px-[7px] py-[2px] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] whitespace-nowrap transition-all duration-120 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            regen
          </button>
        )}
        <button
          onClick={() => openImageModal('Add Image', paragraph.text, null, chapterIndex, paragraphIndex)}
          className="bg-[var(--page)] border border-[var(--rule)] text-[var(--ink3)] text-[0.68rem] px-[7px] py-[2px] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] whitespace-nowrap transition-all duration-120 hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          add image
        </button>
        <button
          onClick={() => deleteParagraph(chapterIndex, paragraphIndex)}
          className="bg-[var(--page)] border border-[var(--rule)] text-[var(--ink3)] text-[0.68rem] px-[7px] py-[2px] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] whitespace-nowrap transition-all duration-120 hover:border-red-400 hover:text-red-500"
        >
          del
        </button>
      </div>
    </div>
  )
}
