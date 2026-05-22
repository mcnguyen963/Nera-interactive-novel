import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStoryStore } from '../stores'
import { ChapterDivider } from '../components/novel/ChapterDivider'
import { ParagraphBlock } from '../components/novel/ParagraphBlock'
import { InputArea } from '../components/layout'
import { Spinner } from '../components/shared'

export function NovelPage() {
  const { story, chapters, activeChapterIndex, isGenerating, resetStory } = useStoryStore()
  const bodyRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [chapters])

  function handleBack() {
    resetStory()
    navigate('/')
  }

  if (!story) return null

  return (
    <div className="flex-1 py-12 px-12 max-w-[70vw]" ref={bodyRef}>
      <button
        onClick={handleBack}
        className="text-[0.78rem] text-[var(--ink3)] hover:text-[var(--accent)] transition-colors mb-6 tracking-[0.08em]"
      >
        ← Back to stories
      </button>
      <h1 className="font-[var(--font-head)] text-[1.5rem] tracking-[0.1em] text-[var(--accent)] text-center mb-1.5">
        {story.title}
      </h1>
      <p className="text-center text-[0.85rem] text-[var(--ink3)] italic mb-12">
        {story.subtitle}
      </p>

      {chapters.map((ch, ci) => (
        <div key={ch.id}>
          <ChapterDivider
            title={ch.title}
            onTitleChange={(newTitle) => {
              const updated = chapters.map((c, i) =>
                i === ci ? { ...c, title: newTitle } : c,
              )
              useStoryStore.setState({ chapters: updated })
            }}
          />
          {ch.paragraphs.map((p, pi) => (
            <ParagraphBlock
              key={p.id}
              chapterIndex={ci}
              paragraphIndex={pi}
              paragraph={p}
            />
          ))}
          {ci === activeChapterIndex && isGenerating && (
            <div className="para-wrap">
              <p className="text-[1rem] leading-[1.85] text-[var(--ink)] py-1">
                <Spinner />
              </p>
            </div>
          )}
        </div>
      ))}
      <InputArea />
    </div>
  )
}
