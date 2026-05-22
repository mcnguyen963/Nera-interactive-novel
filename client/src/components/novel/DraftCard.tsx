import type { Draft } from '../../types/story'
import { Button } from '../shared'

interface DraftCardProps {
  draft: Draft
  onContinue: (draftId: string) => void
  onSaveToCloud: (draftId: string) => void
  onDelete: (draftId: string) => void
}

function snippet(texts: string[]): string {
  const last = texts[texts.length - 1]
  if (!last) return 'No paragraphs yet'
  return last.length > 50 ? last.slice(-50) : last
}

export function DraftCard({ draft, onContinue, onSaveToCloud, onDelete }: DraftCardProps) {
  const { story, chapters, id } = draft
  const totalParagraphs = chapters.reduce((sum, ch) => sum + ch.paragraphs.length, 0)
  const lastParaTexts = chapters
    .flatMap((ch) => ch.paragraphs)
    .map((p) => p.text)

  return (
    <div className="bg-[var(--page)] border border-[var(--accent)] rounded-md p-6 transition-all duration-180 hover:-translate-y-0.5">
      <h3 className="font-[var(--font-head)] text-[0.9rem] text-[var(--ink)] mb-2 tracking-[0.05em]">
        {story.title}
      </h3>
      <p className="text-[0.83rem] text-[var(--ink2)] leading-[1.6] italic mb-2">
        {story.subtitle}
      </p>
      <p className="text-[0.75rem] text-[var(--ink3)] mb-1.5">
        {chapters.length > 0
          ? `Ch ${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][draft.activeChapterIndex] || draft.activeChapterIndex + 1} · ${totalParagraphs} paragraphs`
          : '0 paragraphs'}
      </p>
      <p className="text-[0.78rem] text-[var(--ink2)] italic mb-3.5 leading-[1.5]">
        "{snippet(lastParaTexts)}"
      </p>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="primary"
          className="px-4 py-1.5 text-[0.85rem]"
          onClick={() => onContinue(id)}
        >
          Continue
        </Button>
        <Button
          className="px-4 py-1.5 text-[0.85rem]"
          onClick={() => onSaveToCloud(id)}
        >
          Save to Cloud
        </Button>
        <button
          onClick={() => onDelete(id)}
          className="px-3 py-1.5 text-[0.85rem] text-red-600 border border-red-200 rounded-[var(--r)] bg-transparent hover:border-red-400 transition-colors leading-none"
          title="Delete draft"
        >
          ×
        </button>
      </div>
    </div>
  )
}
