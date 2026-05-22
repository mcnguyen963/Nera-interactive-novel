# Draft Stories — Design Spec

Drafts are **persistent resumable sessions**. Every story is continuously saved to IndexedDB as the user plays. When they navigate back to the homepage, their sessions are already there — no manual save trigger needed.

## Core Concept

- **Drafts = sessions.** A draft is created automatically when `createStory()` is called.
- **Continuous sync.** Every paragraph addition, chapter change, or paragraph update automatically persists to IndexedDB.
- **Multiple sessions.** A user can have many draft cards (different stories returned from at different times).
- **No "save on exit" needed.** The draft is always up-to-date. Going back just reveals what's already saved.

## Data Flow

```
createStory()
        ↓
  auto-create draft in IndexedDB (empty chapters, no paragraphs)
        ↓
  user plays → paragraphs/chapters change
        ↓
  each change → auto-update draft in IndexedDB (background, silent)
        ↓
  user clicks "← Back to stories"
        ↓
  resetStory() → story = null
        ↓
  navigate('/') → HomePage loads all drafts from IndexedDB
        ↓
  draft cards render — user can "Continue" any session
```

## Draft Storage

- **Key:** `nera-drafts` in IndexedDB (via existing `idb-keyval` setup)
- **Value:** array of draft objects
- **Max entries:** 20 (oldest auto-removed when exceeded)
- **Draft object shape:**
  ```ts
  interface Draft {
    id: string;           // original story.id
    story: Story;         // full Story object
    chapters: Chapter[];  // full chapters array
    activeChapterIndex: number;
    savedAt: number;      // timestamp of last update
  }
  ```
- **Persistence:** Always in sync with current story state. Optional "Save to Cloud" pushes to Firestore.

## HomePage Layout

```
┌──────────────────────────────────────┐
│  NERA                                │
│  Choose your world · then craft...   │
│                                      │
│  ┌─ Scenario Cards Grid ─────────┐  │
│  │  ┌──────┐  ┌──────┐          │  │
│  │  │Isekai│  │Dungeon│  ...    │  │
│  │  └──────┘  └──────┘          │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌─ Your Stories ─────────────────┐ │
│  │  ┌──────────────────────────┐  │ │
│  │  │ The Lost Kingdom         │  │ │
│  │  │ A dark fantasy epic      │  │ │
│  │  │ Ch 3 · 12 paragraphs     │  │ │
│  │  │ "The sword glowed as..." │  │ │
│  │  │ [Save Cloud] [Continue] [×] │ │
│  │  └──────────────────────────┘  │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Draft Card Design

- Same card styling as scenario cards (same width, padding, border-radius)
- **Visual distinction:** `border-[var(--accent)]` instead of `border-[var(--rule)]`
- **Content per card:**
  1. **Title** — `story.title` (bold, accent color)
  2. **Subtitle** — `story.subtitle` (italic, ink3 color)
  3. **Metadata** — "Ch {N} · {M} paragraphs" (ink2 color, small font)
  4. **Last paragraph snippet** — last 50 characters of last paragraph (any role), or "No paragraphs yet" if none exist (ink2 color, italic)
  5. **Buttons row** — "Save to Cloud", "Continue", "× Delete"

### Buttons

| Button | Action | Visibility |
|--------|--------|------------|
| **Save to Cloud** | Saves draft to Firestore under user's account | Only if user is logged in |
| **Continue** | Restores draft, sets story/chapters in store, navigates to `/novel` | Always |
| **× Delete** | Removes draft from IndexedDB | Always |

## Draft Card Component

A new `DraftCard` component will be created at `client/src/components/novel/DraftCard.tsx`.

**Props:**
```ts
interface DraftCardProps {
  draft: Draft;
  onContinue: (draftId: string) => void;
  onSaveToCloud: (draftId: string) => void;
  onDelete: (draftId: string) => void;
}
```

**Behavior:**
- Renders a card with title, subtitle, metadata, snippet, buttons
- "Save to Cloud" triggers a cloud save via the existing `saveToCloud` API
- "Continue" restores story state and navigates to `/novel`
- "×" removes draft from IndexedDB

## StoryStore Changes

New methods on `storyStore`:

```ts
interface StoryState {
  // ... existing methods ...

  // Create a new draft entry in IndexedDB
  createDraft: (storyId: string, story: Story, chapters: Chapter[]) => Promise<void>
  // Update the draft in IndexedDB with current story state
  syncDraft: () => void  // syncs — fire and forget, never throws
  // Load all drafts from IndexedDB
  loadDrafts: () => Promise<Draft[]>
  // Restore a draft into the store and remove from drafts list
  restoreDraft: (draftId: string) => Promise<boolean>
  // Remove a draft from IndexedDB
  removeDraft: (draftId: string) => Promise<void>
}
```

**`createDraft` behavior:**
1. Create draft object from `storyId`, `story`, `chapters`, `activeChapterIndex`
2. Fetch existing drafts from IndexedDB
3. If a draft with same `id` exists, update it
4. Otherwise, prepend new draft to array
5. Trim to max 20 entries
6. Save back to IndexedDB

**`syncDraft` behavior:**
1. Check if `story` and `chapters` exist in store
2. If no draft exists for this story, call `createDraft()`
3. Otherwise, fetch drafts, find matching draft by `id`, update with current state
4. Save back to IndexedDB
5. **Fire-and-forget** — never throws, never blocks rendering

**`restoreDraft` behavior:**
1. Fetch draft from IndexedDB by `id`
2. Set `story`, `chapters`, `activeChapterIndex` in store
3. Remove draft from IndexedDB
4. Return `true` on success

**`removeDraft` behavior:**
1. Fetch drafts from IndexedDB
2. Filter out draft with matching `id`
3. Save back to IndexedDB

## HomePage Changes

**New state:** `drafts: Draft[]`

**On mount:**
1. Load drafts from `storyStore.loadDrafts()`
2. Store in component state

**Render:**
- After scenario cards grid, render "Your Stories" section if `drafts.length > 0`
- Section title: "Your Stories"
- Grid of `DraftCard` components

## NovelPage Changes

**`handleBack` behavior:**
1. Call `resetStory()` — clears store
2. Call `navigate('/')` — goes to homepage

(No save needed — draft is already synced in the background)

## Auto-Sync Integration

**Where `syncDraft` is called:**
1. `createStory()` — after creating the story, call `createDraft()`
2. `addParagraph()` — after adding a paragraph, call `syncDraft()`
3. `updateParagraph()` — after updating a paragraph, call `syncDraft()`
4. `deleteParagraph()` — after deleting a paragraph, call `syncDraft()`
5. `addChapter()` — after adding a chapter, call `syncDraft()`
6. `regenerateParagraph()` — after regeneration completes, call `syncDraft()`
7. `setActiveChapter()` — after changing active chapter, call `syncDraft()`

All calls are fire-and-forget (no `await`, no error handling needed). If IndexedDB write fails, the draft is stale but the user continues playing. Next sync will catch up.

## Cloud Save Integration

**`DraftCard` "Save to Cloud" button:**
- Calls `storyStore.saveToCloud(userId)` with the draft's story data
- Shows success/error toast
- Does NOT remove the draft from IndexedDB (cloud save is optional backup)

## Edge Cases

| Case | Handling |
|------|----------|
| User creates story, plays, then closes browser without going back | Draft already synced to IndexedDB — session preserved |
| User creates new story while another draft exists | New story gets its own draft entry; old draft card still shows in "Your Stories" |
| User continues a draft → creates new story → goes back | New story saved as draft, old draft already removed by Continue |
| User clicks "Continue" on same draft twice | Second click loads restored story (no draft exists anymore), behaves normally |
| Cloud save fails | Toast notification, draft stays in IndexedDB |
| Max 20 drafts reached | Oldest draft (by `savedAt`) auto-removed |
| User logs out | Drafts stay in IndexedDB, "Save to Cloud" button hidden |
| User has 0 paragraphs | Metadata shows "0 paragraphs", snippet shows "No paragraphs yet" |
| IndexedDB sync fails mid-play | Draft is stale but user continues. Next sync catches up. No data loss. |

## Files Changed

| File | Change |
|------|--------|
| `client/src/types/story.ts` | Add `Draft` interface |
| `client/src/stores/storyStore.ts` | Add `createDraft`, `syncDraft`, `loadDrafts`, `restoreDraft`, `removeDraft` methods; call `syncDraft` from all mutation methods |
| `client/src/components/novel/DraftCard.tsx` | New component |
| `client/src/pages/HomePage.tsx` | Add "Your Stories" section, render `DraftCard` components |
| `client/src/pages/NovelPage.tsx` | Update `handleBack` to just reset + navigate (no save) |
