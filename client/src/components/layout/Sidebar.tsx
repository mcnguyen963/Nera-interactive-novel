import { useStoryStore, useUiStore } from '../../stores'
import { Button } from '../shared'

export function Sidebar() {
  const { chapters, activeChapterIndex, setActiveChapter, addChapter } = useStoryStore()
  const { openImageModal, isGeneratingImage } = useUiStore()
  const story = useStoryStore((s) => s.story)

  function handleGenerateScene() {
    if (!story) return
    const prompt = `Scene illustration based on: ${story.scenario.setting}`
    openImageModal('Scene Illustration', prompt)
  }

  function handleGenerateCharacter() {
    if (!story) return
    const prompt = `Character portrait of ${story.scenario.companion}`
    openImageModal('Character Portrait', prompt)
  }

  return (
    <aside className="w-[240px] flex-shrink-0 py-8 pl-6 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto">
      <span className="font-[var(--font-head)] text-[0.65rem] tracking-[0.25em] text-[var(--ink3)] mb-3 block">
        Chapters
      </span>
      <div>
        {chapters.map((ch, i) => (
          <div
            key={ch.id}
            className={`px-2.5 py-1.5 rounded-[var(--r)] cursor-pointer text-[0.88rem] text-[var(--ink2)] border-l-2 border-transparent transition-all duration-150 hover:text-[var(--ink)] hover:bg-[var(--highlight)] mb-0.5 ${
              i === activeChapterIndex ? 'border-l-[var(--accent)] text-[var(--accent)] italic' : ''
            }`}
            onClick={() => setActiveChapter(i)}
          >
            {ch.title}
          </div>
        ))}
      </div>

      <div className="mt-5">
        <Button onClick={addChapter} className="w-full text-[0.78rem]">
          + New chapter
        </Button>
      </div>

      <hr className="border-[var(--rule)] my-4 mr-2.5" />
      <span className="font-[var(--font-head)] text-[0.65rem] tracking-[0.25em] text-[var(--ink3)] mb-3 block">
        Scene Tools
      </span>
      <button
        onClick={handleGenerateScene}
        disabled={isGeneratingImage}
        className="flex items-center gap-1.5 w-[calc(100%-10px)] text-[0.78rem] py-1.5 px-2.5 mb-1 bg-none border border-[var(--rule)] text-[var(--ink2)] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        🖼 Generate scene image
      </button>
      <button
        onClick={handleGenerateCharacter}
        disabled={isGeneratingImage}
        className="flex items-center gap-1.5 w-[calc(100%-10px)] text-[0.78rem] py-1.5 px-2.5 mb-1 bg-none border border-[var(--rule)] text-[var(--ink2)] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        👤 Generate character portrait
      </button>
    </aside>
  )
}
