import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { get, set } from 'idb-keyval'
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
import { db } from '../lib/firebase'
import { generateId, timestamp } from '../lib/utils'
import type { Story, Chapter, Paragraph, Scenario } from '../types/story'
import type { FirestoreStory, FirestoreChapter } from '../types/firebase'

const idbStorage = {
  getItem: async (name: string) => {
    const val = await get(name)
    return val !== undefined ? val : null
  },
  setItem: async (name: string, value: unknown): Promise<void> => {
    await set(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    await set(name, undefined)
  },
}

interface StoryState {
  story: Story | null
  chapters: Chapter[]
  activeChapterIndex: number
  isGenerating: boolean
  isSyncing: boolean

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
  addParagraph: (chapterIndex: number, text: string, role: 'narrator' | 'player') => Paragraph
  updateParagraph: (chapterIndex: number, paragraphIndex: number, text: string) => void
  deleteParagraph: (chapterIndex: number, paragraphIndex: number) => void
  addImageToParagraph: (chapterIndex: number, paragraphIndex: number, imageUrl: string) => void
  setGenerating: (val: boolean) => void
  resetStory: () => void

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
      isSyncing: false,

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
        return id
      },

      updateStory: (partial) =>
        set((s) => (s.story ? { story: { ...s.story, ...partial, updatedAt: timestamp() } } : s)),

      setActiveChapter: (index) => set({ activeChapterIndex: index }),

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
      },

      addParagraph: (chapterIndex, text, role) => {
        const { chapters, story } = get()
        const para: Paragraph = {
          id: generateId(),
          text,
          role,
          images: [],
          order: chapters[chapterIndex].paragraphs.length,
        }
        const updated = chapters.map((ch, i) =>
          i === chapterIndex
            ? { ...ch, paragraphs: [...ch.paragraphs, para], updatedAt: timestamp() }
            : ch,
        )
        set({ chapters: updated, story: story ? { ...story, updatedAt: timestamp() } : null })
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
      },

      deleteParagraph: (chapterIndex, paragraphIndex) => {
        const { chapters } = get()
        const updated = chapters.map((ch, ci) =>
          ci === chapterIndex
            ? { ...ch, paragraphs: ch.paragraphs.filter((_, pi) => pi !== paragraphIndex), updatedAt: timestamp() }
            : ch,
        )
        set({ chapters: updated })
      },

      addImageToParagraph: (chapterIndex, paragraphIndex, imageUrl) => {
        const { chapters } = get()
        const updated = chapters.map((ch, ci) =>
          ci === chapterIndex
            ? {
                ...ch,
                paragraphs: ch.paragraphs.map((p, pi) =>
                  pi === paragraphIndex ? { ...p, images: [...p.images, imageUrl] } : p,
                ),
              }
            : ch,
        )
        set({ chapters: updated })
      },

      setGenerating: (val) => set({ isGenerating: val }),

      resetStory: () => set({ story: null, chapters: [], activeChapterIndex: 0 }),

      saveToCloud: async (userId) => {
        const { story, chapters } = get()
        if (!story) return
        set({ isSyncing: true })
        try {
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
        await deleteDoc(doc(db, 'stories', storyId))
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
    },
  ),
)
