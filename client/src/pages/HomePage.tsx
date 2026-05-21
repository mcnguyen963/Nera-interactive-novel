import { useState } from 'react'
import { SCENARIOS } from '../scenarios'
import { useAuthStore, useStoryStore } from '../stores'
import { Button } from '../components/shared'
import type { ScenarioDef } from '../types/story'

export function HomePage() {
  const [selected, setSelected] = useState<ScenarioDef | null>(null)
  const [userSetting, setUserSetting] = useState('')
  const [userChar, setUserChar] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userHook, setUserHook] = useState('')
  const { user } = useAuthStore()
  const { createStory } = useStoryStore()

  function handleSelect(s: ScenarioDef) {
    setSelected(s)
    setUserSetting(s.setting || '')
    setUserChar(s.char || '')
    setUserRole(s.player || '')
    setUserHook(s.hook || '')
  }

  function handleBegin() {
    if (!selected || !user) return
    const scenarioDef = {
      setting: userSetting || selected.setting || 'A mysterious fantasy world.',
      companion: userChar || selected.char || 'A mysterious guide.',
      player: userRole || selected.player || 'A traveller seeking answers.',
      hook: userHook || selected.hook || 'The adventure begins.',
    }
    createStory({
      title: selected.title,
      subtitle: selected.sub,
      scenarioId: selected.id,
      scenario: scenarioDef,
      userId: user.uid,
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-start p-8 overflow-y-auto">
      <h1 className="font-[var(--font-head)] text-[1.6rem] tracking-[0.15em] text-[var(--accent)] mb-1.5">
        NERA
      </h1>
      <p className="text-[0.88rem] text-[var(--ink3)] italic mb-6">
        Choose your world · then craft your setting
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5 w-full max-w-[800px]">
        {SCENARIOS.map((s) => (
          <div
            key={s.id}
            className={`bg-[var(--page)] border border-[var(--rule)] rounded-md p-[18px] cursor-pointer transition-all duration-180 hover:border-[var(--accent)] hover:-translate-y-0.5 ${
              selected?.id === s.id ? 'border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]' : ''
            }`}
            onClick={() => handleSelect(s)}
          >
            <h3 className="font-[var(--font-head)] text-[0.9rem] text-[var(--ink)] mb-1.5 tracking-[0.05em]">
              {s.title}
            </h3>
            <p className="text-[0.83rem] text-[var(--ink2)] leading-[1.5]">{s.sub}</p>
            <span className="inline-block mt-2.5 font-[var(--font-head)] text-[0.65rem] tracking-[0.15em] text-[var(--accent)] opacity-80">
              {s.tag}
            </span>
          </div>
        ))}
      </div>

      {selected && (
        <div className="w-full max-w-[800px] mt-5 bg-[var(--page)] border border-[var(--rule)] rounded-md p-5">
          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
              Your Story Setting
            </label>
            <textarea
              value={userSetting}
              onChange={(e) => setUserSetting(e.target.value)}
              rows={5}
              placeholder={selected.id === 'custom' ? 'Describe your world from scratch…' : 'Add extra details to the scenario setting…'}
              className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none resize-y min-h-[80px] leading-[1.55] focus:border-[var(--accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
                Main Companion / NPC
              </label>
              <input
                value={userChar}
                onChange={(e) => setUserChar(e.target.value)}
                placeholder="Name and description"
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
                placeholder="Who you are in this world"
                className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
                Opening Hook
              </label>
              <input
                value={userHook}
                onChange={(e) => setUserHook(e.target.value)}
                placeholder="e.g. You wake in a unfamiliar place…"
                className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex gap-2.5 items-center mt-4">
            <Button variant="primary" onClick={handleBegin} className="px-6 py-2 text-[0.95rem]">
              ✨ Begin Novel
            </Button>
            <Button onClick={() => setSelected(null)}>Clear selection</Button>
          </div>
        </div>
      )}
    </div>
  )
}
