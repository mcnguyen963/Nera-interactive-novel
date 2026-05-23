import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SCENARIOS } from '../scenarios'
import { useAuthStore, useStoryStore } from '../stores'
import { Button, Modal } from '../components/shared'
import { DraftCard } from '../components/novel'
import type { ScenarioDef, Draft } from '../types/story'
import { generateId } from '../lib/utils'

export function HomePage() {
  const [selected, setSelected] = useState<ScenarioDef | null>(null)
  const [userSetting, setUserSetting] = useState('')
  const [userChar, setUserChar] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userHook, setUserHook] = useState('')
  const [userWorldName, setUserWorldName] = useState('')
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { restoreDraft, saveToCloud, removeDraft, loadDrafts } = useStoryStore()
  const [drafts, setDrafts] = useState<Draft[]>([])

  useEffect(() => {
    loadDrafts().then(setDrafts)
  }, [loadDrafts])

  function handleSelect(s: ScenarioDef) {
    setSelected(s)
    setUserWorldName(s.title || '')
    setUserSetting(s.setting || '')
    setUserChar(s.char || '')
    setUserRole(s.player || '')
    setUserHook(s.hook || '')
  }

  function handleBegin() {
    if (!selected || !user) return
    
    const now = Date.now()
    const storyId = generateId()
    
    useStoryStore.setState({
      story: {
        id: storyId,
        userId: user.uid,
        title: userWorldName || selected.title,
        subtitle: selected.sub,
        scenarioId: selected.id,
        scenario: {
          setting: userSetting || selected.setting || 'A mysterious fantasy world.',
          companion: userChar || selected.char || 'A mysterious guide.',
          player: userRole || selected.player || 'A traveller seeking answers.',
          hook: userHook || selected.hook || 'The adventure begins.',
        },
        createdAt: now,
        updatedAt: now,
      },
      chapters: [{
        id: generateId(),
        title: 'Chapter I',
        order: 0,
        createdAt: now,
        updatedAt: now,
        paragraphs: [],
      }],
      activeChapterIndex: 0,
    })
    
    useStoryStore.getState().syncDraft()
    navigate('/novel')
  }

  async function handleContinue(draftId: string) {
    const ok = await restoreDraft(draftId)
    if (ok) navigate('/novel')
  }

  async function handleSaveToCloud(_draftId: string) {
    if (!user) return
    try {
      await saveToCloud(user.uid)
    } catch {
      // silent
    }
  }

  async function handleDeleteDraft(draftId: string) {
    await removeDraft(draftId)
    setDrafts((prev) => prev.filter((d) => d.id !== draftId))
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-start p-8 overflow-y-auto">
      <h1 className="font-[var(--font-head)] text-[1.6rem] tracking-[0.15em] text-[var(--accent)] mb-1.5">
        NERA
      </h1>
      <p className="text-[0.88rem] text-[var(--ink3)] italic mb-6">
        Choose your world · then craft your setting
      </p>

      {drafts.length > 0 && (
      <div className="w-[80vw] mb-8">
          <hr className="border-[var(--rule)] mb-6" />
          <h2 className="font-[var(--font-head)] text-[1rem] tracking-[0.12em] text-[var(--accent)] mb-4">
            Your Stories
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                onContinue={handleContinue}
                onSaveToCloud={handleSaveToCloud}
                onDelete={handleDeleteDraft}
              />
            ))}
          </div>
        </div>
      )}

    <div className="w-[80vw] mb-8">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 w-full">
          {SCENARIOS.map((s) => (
            <div
              key={s.id}
              className={`bg-[var(--page)] border border-[var(--rule)] rounded-md p-6 cursor-pointer transition-all duration-180 hover:border-[var(--accent)] hover:-translate-y-0.5 ${
                selected?.id === s.id ? 'border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]' : ''
              }`}
              onClick={() => handleSelect(s)}
            >
              <h3 className="font-[var(--font-head)] text-[0.9rem] text-[var(--ink)] mb-2 tracking-[0.05em]">
                {s.title}
              </h3>
              <p className="text-[0.83rem] text-[var(--ink2)] leading-[1.6]">{s.sub}</p>
              <span className="inline-block mt-3 font-[var(--font-head)] text-[0.65rem] tracking-[0.15em] text-[var(--accent)] opacity-80">
                {s.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} className="w-[60vw]">
        <h2 className="font-[var(--font-head)] text-[1.1rem] text-[var(--accent)] mb-4 tracking-[0.08em]">
          {selected?.title}
        </h2>
        <div className="flex flex-col gap-1.5 mb-3.5">
          <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
            Your Story Setting
          </label>
          <textarea
            value={userSetting}
            onChange={(e) => setUserSetting(e.target.value)}
            rows={5}
            placeholder={selected?.id === 'custom' ? 'Describe your world - the setting, time period, mood, and key elements that make it unique...' : 'Add extra details to the scenario setting...'}
            className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none resize-y min-h-[80px] leading-[1.55] focus:border-[var(--accent)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
              Main Companion / NPC
            </label>
            <input
              value={userChar}
              onChange={(e) => setUserChar(e.target.value)}
              placeholder={selected?.id === 'custom' ? 'Who will guide or accompany you in this world? Give them personality and background...' : 'Name and description'}
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
              Your Role / Character
            </label>
            <input
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              placeholder={selected?.id === 'custom' ? 'Who are you in this world? What is your role, background, and special qualities...' : 'Who you are in this world'}
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
            Opening Hook
          </label>
          <input
            value={userHook}
            onChange={(e) => setUserHook(e.target.value)}
            placeholder={selected?.id === 'custom' ? 'How does your adventure begin? What is the inciting incident that kicks off your story...' : 'e.g. You wake in a unfamiliar place…'}
            className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex gap-2.5 items-center">
          <Button variant="primary" onClick={handleBegin} className="px-6 py-2 text-[0.95rem]">
            ✨ Begin Novel
          </Button>
          <Button onClick={() => setSelected(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  )
}
