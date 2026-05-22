import { useState } from 'react'
import { useStoryStore, useUiStore } from '../../stores'
import { Button } from '../shared'

export function Sidebar() {
  const { chapters, activeChapterIndex, setActiveChapter, addChapter, saveToLocal, loadFromLocal, listLocalStories } = useStoryStore()
  const { openImageModal, addToast, isGeneratingImage } = useUiStore()
  const story = useStoryStore((s) => s.story)
  const [localStories, setLocalStories] = useState<string[]>([])

  function handleGenerateScene() {
    if (!story) return
    const prompt = `Scene illustration based on: ${story.scenario.setting}`
    openImageModal('Scene Illustration', prompt, null, activeChapterIndex)
  }

  function handleGenerateCharacter() {
    if (!story) return
    const prompt = `Character portrait of ${story.scenario.companion}`
    openImageModal('Character Portrait', prompt, null, activeChapterIndex)
  }

  async function handleSaveLocal() {
    const ok = await saveToLocal()
    addToast(ok ? 'Saved to local files' : 'Failed to save locally', ok ? 'success' : 'error')
  }

  async function handleListLocal() {
    const ids = await listLocalStories()
    setLocalStories(ids)
  }

  async function handleLoadLocal(storyId: string) {
    const ok = await loadFromLocal(storyId)
    addToast(ok ? 'Loaded from local files' : 'Failed to load', ok ? 'success' : 'error')
  }

  return (
    <aside className="w-[240px] flex-shrink-0 py-10 px-6 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
      <span className="font-[var(--font-head)] text-[0.65rem] tracking-[0.25em] text-[var(--ink3)] mb-3 block">
        Chapters
      </span>
      <div>
        {chapters.map((ch, i) => (
          <div
            key={ch.id}
            className={`px-3 py-2 rounded-[var(--r)] cursor-pointer text-[0.88rem] text-[var(--ink2)] border-l-2 border-transparent transition-all duration-150 hover:text-[var(--ink)] hover:bg-[var(--highlight)] mb-1 ${
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

      <hr className="border-[var(--rule)] my-5" />
      <span className="font-[var(--font-head)] text-[0.65rem] tracking-[0.25em] text-[var(--ink3)] mb-4 block">
        Local Storage
      </span>
      <button
        onClick={handleSaveLocal}
        disabled={!story}
        className="flex items-center gap-1.5 w-full text-[0.78rem] py-2 px-3 mb-1.5 bg-none border border-[var(--rule)] text-[var(--ink2)] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        💾 Save to local file
      </button>
      <button
        onClick={handleListLocal}
        className="flex items-center gap-1.5 w-full text-[0.78rem] py-2 px-3 mb-1.5 bg-none border border-[var(--rule)] text-[var(--ink2)] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        📂 Load from local file
      </button>
      {localStories.length > 0 && (
        <div className="ml-2 mt-1">
          {localStories.map((id) => (
            <div
              key={id}
              onClick={() => handleLoadLocal(id)}
              className="px-3 py-1.5 rounded-[var(--r)] cursor-pointer text-[0.78rem] text-[var(--ink2)] hover:text-[var(--accent)] hover:bg-[var(--highlight)] transition-all duration-150"
            >
              {id}
            </div>
          ))}
        </div>
      )}

      <hr className="border-[var(--rule)] my-5" />
      <span className="font-[var(--font-head)] text-[0.65rem] tracking-[0.25em] text-[var(--ink3)] mb-4 block">
        Scene Tools
      </span>
      <button
        onClick={handleGenerateScene}
        disabled={isGeneratingImage}
        className="flex items-center gap-1.5 w-full text-[0.78rem] py-2 px-3 mb-1.5 bg-none border border-[var(--rule)] text-[var(--ink2)] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        🖼 Generate scene image
      </button>
      <button
        onClick={handleGenerateCharacter}
        disabled={isGeneratingImage}
        className="flex items-center gap-1.5 w-full text-[0.78rem] py-2 px-3 mb-1.5 bg-none border border-[var(--rule)] text-[var(--ink2)] rounded-[var(--r)] cursor-pointer font-[var(--font-body)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
      >
        👤 Generate character portrait
      </button>
    </aside>
  )
}
