import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import {
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { db, storage, auth } from '../lib/firebase'
import { generateId, timestamp, buildKVContext, buildPreviousChaptersContext } from '../lib/utils'
import { streamLlmChat, saveStory as apiSaveStory, loadStory as apiLoadStory, listStories as apiListStories } from '../lib/edgeApi'
import type { Story, Chapter, Paragraph, Scenario, Draft } from '../types/story'
import type { FirestoreStory, FirestoreChapter } from '../types/firebase'

const DRAFTS_KEY = 'nera-drafts'

const idbStorage = {
  getItem: async (name: string) => {
    const val = await idbGet(name)
    return val !== undefined ? val : null
  },
  setItem: async (name: string, value: unknown): Promise<void> => {
    await idbSet(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await idbSet(name, undefined)
  },
}

interface StoryState {
  story: Story | null
  chapters: Chapter[]
  activeChapterIndex: number
  isGenerating: boolean
  isSummarizing: boolean
  isSyncing: boolean
  regeneratingParagraphId: string | null

  createStory: (params: {
    title: string
    subtitle: string
    scenarioId: string
    scenario: Scenario
    userId: string
  }) => string
  updateStory: (partial: Partial<Story>) => void
  setActiveChapter: (index: number) => void
  addChapter: () => void
  generateChapterSummary: () => Promise<void>
  addParagraph: (chapterIndex: number, text: string, role: 'narrator' | 'player') => Paragraph
  updateParagraph: (chapterIndex: number, paragraphIndex: number, text: string) => void
  deleteParagraph: (chapterIndex: number, paragraphIndex: number) => void
  addImageToParagraph: (chapterIndex: number, paragraphIndex: number, imageUrl: string, imageDescription?: string) => void
  regenerateParagraph: (chapterIndex: number, paragraphIndex: number) => Promise<void>
  setGenerating: (val: boolean) => void
  resetStory: () => void

  saveToLocal: () => Promise<boolean>
  loadFromLocal: (storyId: string) => Promise<boolean>
  listLocalStories: () => Promise<string[]>

  createDraft: (id: string, story: Story, chapters: Chapter[]) => Promise<void>
  syncDraft: () => Promise<void>
  loadDrafts: () => Promise<Draft[]>
  restoreDraft: (draftId: string) => Promise<boolean>
  removeDraft: (draftId: string) => Promise<void>
  saveToCloud: (userId: string) => Promise<void>
  loadFromCloud: (storyId: string, userId: string) => Promise<void>
  deleteFromCloud: (storyId: string) => Promise<void>
  listCloudStories: (userId: string) => Promise<FirestoreStory[]>
}

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      story: null,
      chapters: [],
      activeChapterIndex: 0,
isGenerating: false,
  isSummarizing: false,
  isSyncing: false,
      regeneratingParagraphId: null,

      createStory: ({ title, subtitle, scenarioId, scenario, userId }) => {
        const id = generateId()
        const now = timestamp()
        const story: Story = {
          id,
          userId,
          title,
          subtitle,
          scenarioId,
          scenario,
          createdAt: now,
          updatedAt: now,
        }
        const firstChapter: Chapter = {
          id: generateId(),
          title: 'Chapter I',
          order: 0,
          createdAt: now,
          updatedAt: now,
          paragraphs: [],
        }
        set({ story, chapters: [firstChapter], activeChapterIndex: 0 })
        get().syncDraft()
        return id
      },

      updateStory: (partial) =>
        set((s) => (s.story ? { story: { ...s.story, ...partial, updatedAt: timestamp() } } : s)),

      setActiveChapter: (index) => {
        set({ activeChapterIndex: index })
        get().syncDraft()
      },

      addChapter: () => {
        const { chapters } = get()
        const n = chapters.length + 1
        const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
        const now = timestamp()
        const chapter: Chapter = {
          id: generateId(),
          title: `Chapter ${roman[n - 1] || n}`,
          order: n - 1,
          createdAt: now,
          updatedAt: now,
          paragraphs: [],
        }
        set({ chapters: [...chapters, chapter], activeChapterIndex: chapters.length })
        get().syncDraft()
        // auto-generate summary when transitioning to chapter 2+
        if (chapters.length >= 1) {
          get().generateChapterSummary()
        }
      },

      generateChapterSummary: async () => {
        const { story, chapters, activeChapterIndex } = get()
        if (!story || activeChapterIndex < 1) return

        set({ isSummarizing: true })
        const prevChapters = chapters.slice(0, activeChapterIndex)
        const prevText = buildPreviousChaptersContext(prevChapters)
        if (!prevText) {
          set({ isSummarizing: false })
          return
        }

        const { useSettingsStore } = await import('../stores/settingsStore')
        const llm = useSettingsStore.getState().llm

        const summaryPrompt = `You are a story summarizer. Read the previous chapters of this story and produce a concise, detailed summary that captures:
- Key plot events and developments
- Character actions and decisions
- Important dialogue or revelations
- Current situation and setting

Write in third person past tense, matching the story's narrative style. Keep it detailed enough to maintain full continuity.

--- PREVIOUS CHAPTERS ---
${prevText}

--- SUMMARY ---`

        const messages = [
          { role: 'system', content: summaryPrompt },
        ]

        let fullSummary = ''
        try {
          await streamLlmChat(
            {
              messages,
              provider: llm.provider,
              model: llm.provider === 'openrouter' ? llm.openrouterModel : llm.localModel,
              temperature: llm.temperature,
              maxTokens: llm.maxTokens,
              localUrl: llm.localUrl,
              apiKey: llm.apiKey,
              customUrl: llm.customUrl,
              customApiKey: llm.customApiKey,
            },
            (chunk) => {
              fullSummary += chunk
            },
          )
          if (fullSummary.trim()) {
            set({
              story: story ? { ...story, previousChapterSummary: fullSummary.trim(), updatedAt: timestamp() } : null,
              isSummarizing: false,
            })
            get().syncDraft()
          } else {
            set({ isSummarizing: false })
          }
        } catch {
          set({ isSummarizing: false })
          // summary generation failed — keep existing summary
        }
      },

      addParagraph: (chapterIndex, text, role) => {
        const { chapters, story } = get()
        const para: Paragraph = {
          id: generateId(),
          text,
          role,
          images: [],
          imageDescriptions: [],
          order: chapters[chapterIndex].paragraphs.length,
        }
        const updated = chapters.map((ch, i) =>
          i === chapterIndex
            ? { ...ch, paragraphs: [...ch.paragraphs, para], updatedAt: timestamp() }
            : ch,
        )
        set({ chapters: updated, story: story ? { ...story, updatedAt: timestamp() } : null })
        get().syncDraft()
        return para
      },

      updateParagraph: (chapterIndex, paragraphIndex, text) => {
        const { chapters } = get()
        const updated = chapters.map((ch, ci) =>
          ci === chapterIndex
            ? {
                ...ch,
                paragraphs: ch.paragraphs.map((p, pi) => (pi === paragraphIndex ? { ...p, text } : p)),
                updatedAt: timestamp(),
              }
            : ch,
        )
        set({ chapters: updated })
        get().syncDraft()
      },

      deleteParagraph: (chapterIndex, paragraphIndex) => {
        const { chapters } = get()
        const updated = chapters.map((ch, ci) =>
          ci === chapterIndex
            ? { ...ch, paragraphs: ch.paragraphs.filter((_, pi) => pi !== paragraphIndex), updatedAt: timestamp() }
            : ch,
        )
        set({ chapters: updated })
        get().syncDraft()
      },

      addImageToParagraph: (chapterIndex, paragraphIndex, imageUrl, imageDescription) => {
        const { chapters } = get()
        const updated = chapters.map((ch, ci) =>
          ci === chapterIndex
            ? {
                ...ch,
                paragraphs: ch.paragraphs.map((p, pi) =>
                  pi === paragraphIndex
                    ? {
                        ...p,
                        images: [...(p.images || []), imageUrl],
                        imageDescriptions: [...(p.imageDescriptions || []), imageDescription || ''],
                      }
                    : p,
                ),
              }
            : ch,
        )
        set({ chapters: updated })
      },

      setGenerating: (val) => set({ isGenerating: val }),

      createDraft: async (id, story, chapters) => {
        const { activeChapterIndex } = get()
        const draft: Draft = { id, story, chapters, activeChapterIndex, savedAt: timestamp() }
        const existing: Draft[] = (await idbGet(DRAFTS_KEY)) || []
        const idx = existing.findIndex((d) => d.id === id)
        if (idx >= 0) {
          existing[idx] = draft
        } else {
          existing.unshift(draft)
          if (existing.length > 20) existing.pop()
        }
        await idbSet(DRAFTS_KEY, existing)
      },

      syncDraft: async () => {
        try {
          const { story, chapters, activeChapterIndex } = get()
          if (!story) return
          const existing: Draft[] = (await idbGet(DRAFTS_KEY)) || []
          const idx = existing.findIndex((d) => d.id === story.id)
          const draft: Draft = { id: story.id, story, chapters, activeChapterIndex, savedAt: timestamp() }
          if (idx >= 0) {
            existing[idx] = draft
          } else {
            existing.unshift(draft)
            if (existing.length > 20) existing.pop()
          }
          await idbSet(DRAFTS_KEY, existing)
        } catch {
          // fire-and-forget: silently ignore IndexedDB errors
        }
      },

      loadDrafts: async () => {
        try {
          return (await idbGet(DRAFTS_KEY)) || []
        } catch {
          return []
        }
      },

      restoreDraft: async (draftId) => {
        try {
          const existing: Draft[] = (await idbGet(DRAFTS_KEY)) || []
          const draft = existing.find((d) => d.id === draftId)
          if (!draft) return false
          set({
            story: draft.story,
            chapters: draft.chapters,
            activeChapterIndex: draft.activeChapterIndex,
          })
          return true
        } catch {
          return false
        }
      },

      removeDraft: async (draftId) => {
        try {
          const existing: Draft[] = (await idbGet(DRAFTS_KEY)) || []
          await idbSet(DRAFTS_KEY, existing.filter((d) => d.id !== draftId))
        } catch {
          // fire-and-forget
        }
      },

      regenerateParagraph: async (chapterIndex, paragraphIndex) => {
        const { story, chapters, regeneratingParagraphId } = get()
        const para = chapters[chapterIndex]?.paragraphs[paragraphIndex]
        if (!story || !para || regeneratingParagraphId) return

        set({ regeneratingParagraphId: para.id })

        const allParas = chapters.flatMap((c) => c.paragraphs)
        const before = allParas.slice(0, allParas.indexOf(para))

        const { useSettingsStore } = await import('../stores/settingsStore')
        const llm = useSettingsStore.getState().llm
        const ctx = buildKVContext(story.scenario, before, llm.contextWindow)

        try {
          const systemPrompt = llm.systemPrompt + '\n\n## Story Context (Key-Value)\n' + ctx
          const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Rewrite the following paragraph of the story in a different way, keeping the same meaning and style:\n\n${para.text}` },
          ]

          let fullText = ''
          await streamLlmChat(
            {
              messages,
              provider: llm.provider,
              model: llm.provider === 'openrouter' ? llm.openrouterModel : llm.localModel,
              temperature: llm.temperature,
              maxTokens: llm.maxTokens,
              localUrl: llm.localUrl,
              apiKey: llm.apiKey,
              customUrl: llm.customUrl,
              customApiKey: llm.customApiKey,
            },
            (chunk) => {
              fullText += chunk
              const store = useStoryStore.getState()
              store.updateParagraph(chapterIndex, paragraphIndex, fullText)
            },
          )

          const store = useStoryStore.getState()
          store.updateParagraph(chapterIndex, paragraphIndex, fullText.trim())
        } catch {
          // regeneration failed — keep original text
        } finally {
          set({ regeneratingParagraphId: null })
        }
      },

      resetStory: () => set({ story: null, chapters: [], activeChapterIndex: 0 }),

      saveToLocal: async () => {
        const { story, chapters } = get()
        if (!story) return false
        try {
          const res = await apiSaveStory(story.id, { story, chapters })
          return res.ok
        } catch {
          return false
        }
      },

      loadFromLocal: async (storyId) => {
        try {
          const res = await apiLoadStory(storyId)
          if (!res.ok) return false
          const data = await res.json()
          set({
            story: data.story,
            chapters: data.chapters || [],
            activeChapterIndex: 0,
          })
          return true
        } catch {
          return false
        }
      },

      listLocalStories: async () => {
        try {
          const res = await apiListStories()
          if (!res.ok) return []
          const data = await res.json()
          return data.stories || []
        } catch {
          return []
        }
      },

      saveToCloud: async (userId) => {
        const { story, chapters } = get()
        if (!story) return
        set({ isSyncing: true })
        try {
          const { useSettingsStore } = await import('../stores/settingsStore')
          const { cloudTextBackup, cloudImageBackup } = useSettingsStore.getState().backup

          if (cloudTextBackup) {
            const batch = writeBatch(db)
            const storyRef = doc(db, 'stories', story.id)
            const firestoreStory: FirestoreStory = {
              id: story.id,
              userId,
              title: story.title,
              subtitle: story.subtitle,
              scenarioId: story.scenarioId,
              scenario: story.scenario,
              createdAt: story.createdAt,
              updatedAt: timestamp(),
            }
            batch.set(storyRef, firestoreStory, { merge: true })

            for (const ch of chapters) {
              const chapterRef = doc(db, 'stories', story.id, 'chapters', ch.id)
              const firestoreChapter: FirestoreChapter = {
                id: ch.id,
                title: ch.title,
                order: ch.order,
                createdAt: ch.createdAt,
                updatedAt: timestamp(),
                paragraphs: ch.paragraphs,
              }
              batch.set(chapterRef, firestoreChapter, { merge: true })
            }

            await batch.commit()
          }

          if (cloudImageBackup) {
            for (const ch of chapters) {
              for (const p of ch.paragraphs) {
                for (let i = 0; i < (p.images || []).length; i++) {
                  const url = p.images[i]
                  if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
                    const imageRef = ref(storage, `images/${story.id}/${ch.id}/${p.id}_${i}.png`)
                    await uploadString(imageRef, url, 'data_url')
                    p.images[i] = await getDownloadURL(imageRef)
                  }
                }
              }
            }
          }

          set({ isSyncing: false, story: { ...story, updatedAt: timestamp() } })
        } catch (err) {
          set({ isSyncing: false })
          throw err
        }
      },

      loadFromCloud: async (storyId, _userId) => {
        set({ isSyncing: true })
        try {
          const storyRef = doc(db, 'stories', storyId)
          const storySnap = await getDoc(storyRef)
          if (!storySnap.exists()) throw new Error('Story not found')
          const data = storySnap.data() as FirestoreStory

          const chaptersQuery = query(
            collection(db, 'stories', storyId, 'chapters'),
            orderBy('order', 'asc'),
          )
          const chapterSnaps = await getDocs(chaptersQuery)
          const chapters: Chapter[] = chapterSnaps.docs.map((d) => d.data() as Chapter)

          const story: Story = {
            id: data.id,
            userId: data.userId,
            title: data.title,
            subtitle: data.subtitle,
            scenarioId: data.scenarioId,
            scenario: data.scenario,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          }

          set({ story, chapters, activeChapterIndex: 0, isSyncing: false })
        } catch (err) {
          set({ isSyncing: false })
          throw err
        }
      },

      deleteFromCloud: async (storyId) => {
        try {
          await deleteDoc(doc(db, 'stories', storyId))
        } catch {
          // continue to clean up other data even if Firestore delete fails
        }

        try {
          const imagesRef = ref(storage, `images/${storyId}`)
          const user = auth.currentUser
          if (user) {
            const imageList = await listAll(imagesRef)
            const deletePromises = imageList.items.map((itemRef) => deleteObject(itemRef))
            await Promise.allSettled(deletePromises)
          }
        } catch {
          // continue even if image deletion fails
        }

        try {
          const { deleteStory: deleteStoryApi } = await import('../lib/edgeApi')
          await deleteStoryApi(storyId).catch(() => {})
        } catch {
          // continue even if local delete fails
        }

        try {
          const existing: Draft[] = (await idbGet(DRAFTS_KEY)) || []
          await idbSet(DRAFTS_KEY, existing.filter((d) => d.id !== storyId))
        } catch {
          // continue even if draft removal fails
        }

        set({ story: null, chapters: [], activeChapterIndex: 0 })
      },

      listCloudStories: async (userId) => {
        const storiesQuery = query(collection(db, 'stories'))
        const snapshot = await getDocs(storiesQuery)
        return snapshot.docs
          .map((d) => d.data() as FirestoreStory)
          .filter((s) => s.userId === userId)
      },

    }),
    {
      name: 'nera-story',
      storage: idbStorage,
      partialize: (state) => ({
        story: state.story,
        chapters: state.chapters,
        activeChapterIndex: state.activeChapterIndex,
      }),
    },
  ),
)
