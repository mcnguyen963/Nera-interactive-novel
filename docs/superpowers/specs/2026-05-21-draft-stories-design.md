# Draft Stories — Design Spec

When a user navigates back from a novel to the homepage, the current story state is saved as a recoverable draft card.

## Data Flow

```
NovelPage "← Back to stories"
        ↓
  save draft to IndexedDB (story + chapters + activeChapterIndex)
        ↓
  resetStory() → story = null
        ↓
  navigate('/') → HomePage renders draft cards
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
    savedAt: number;      // timestamp
  }
  ```
- **Persistence:** Auto-saves to IndexedDB on back navigation. Optional "Save to Cloud" pushes to Firestore.

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
  4. **Last paragraph snippet** — last 50 characters of last narrator paragraph (ink2 color, italic)
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

  // Save current story as a recoverable draft
  saveDraft: () => Promise<void>
  // Load draft data from IndexedDB
  loadDrafts: () => Promise<Draft[]>
  // Restore a draft into the store and remove from drafts list
  restoreDraft: (draftId: string) => Promise<boolean>
  // Remove a draft from IndexedDB
  removeDraft: (draftId: string) => Promise<void>
}
```

**`saveDraft` behavior:**
1. Check if `story` and `chapters` exist
2. Fetch existing drafts from IndexedDB
3. If a draft with same `id` exists, update it (replace with current state)
4. Otherwise, prepend new draft to array
5. Trim to max 20 entries
6. Save back to IndexedDB

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
1. Call `storyStore.saveDraft()` — saves current story as draft
2. Call `resetStory()` — clears store
3. Call `navigate('/')` — goes to homepage

## Cloud Save Integration

**`DraftCard` "Save to Cloud" button:**
- Calls `storyStore.saveToCloud(userId)` with the draft's story data
- Shows success/error toast
- Does NOT remove the draft from IndexedDB (cloud save is optional backup)

## Edge Cases

| Case | Handling |
|------|----------|
| User creates new story, starts typing but doesn't go back | No draft created — only back navigation triggers save |
| User continues a draft → creates new story → goes back | New story saved as draft, old draft removed (Continue already removed it) |
| User clicks "Continue" on same draft twice | Second click loads restored story (no draft exists anymore), behaves normally |
| Cloud save fails | Toast notification, draft stays in IndexedDB |
| Max 20 drafts reached | Oldest draft (by `savedAt`) auto-removed |
| User logs out | Drafts stay in IndexedDB, "Save to Cloud" button hidden |
| User has 0 paragraphs | Metadata shows "0 paragraphs", snippet area empty |

## Files Changed

| File | Change |
|------|--------|
| `client/src/types/story.ts` | Add `Draft` interface |
| `client/src/stores/storyStore.ts` | Add `saveDraft`, `loadDrafts`, `restoreDraft`, `removeDraft` methods |
| `client/src/components/novel/DraftCard.tsx` | New component |
| `client/src/pages/HomePage.tsx` | Add "Your Stories" section, render `DraftCard` components |
| `client/src/pages/NovelPage.tsx` | Update `handleBack` to call `saveDraft()` |
