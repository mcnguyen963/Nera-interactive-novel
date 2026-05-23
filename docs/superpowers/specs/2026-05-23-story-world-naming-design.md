# Story World Naming Design

## Problem

When users create a new story in NERA, the story title is auto-set to the scenario name (e.g., "Isekai Transit", "Eldenwynn Academy"). Users have no way to give their story/world a custom name before beginning.

## Solution

Add a "World Name" text input at the top of the scenario configuration modal. The input is pre-filled with the selected scenario's title and can be freely edited by the user.

## Design Decisions

1. **Pre-filled input** — The input defaults to the scenario title so users see a suggestion but aren't locked in.
2. **Top of modal** — Placed above the existing fields (Setting, Companion, Role, Hook) as the first thing users see.
3. **Subtitle unchanged** — The scenario's subtitle/description remains as the story subtitle regardless of name changes.
4. **Single file change** — Only `HomePage.tsx` needs modification. No type, store, or route changes required.

## Implementation

### Changes to `HomePage.tsx`

1. Add state: `const [userWorldName, setUserWorldName] = useState('')`
2. In `handleSelect()`, initialize: `setUserWorldName(s.title || '')`
3. Add input field at top of modal:
   ```tsx
   <div className="flex flex-col gap-1.5 mb-3.5">
     <label className="text-[0.78rem] text-[var(--ink3)] font-[var(--font-head)] tracking-[0.08em]">
       World Name
     </label>
     <input
       value={userWorldName}
       onChange={(e) => setUserWorldName(e.target.value)}
       placeholder="Give your world a name..."
       className="bg-[var(--bg)] border border-[var(--rule)] text-[var(--ink)] rounded-[var(--r)] p-[7px_11px] font-[var(--font-body)] text-[0.9rem] outline-none focus:border-[var(--accent)]"
     />
   </div>
   ```
4. In `handleBegin()`, use: `title: userWorldName || selected.title`

### No changes needed to:
- `types/story.ts` — `Story.title` already exists
- `stores/storyStore.ts` — `handleBegin` already sets story title
- `scenarios/index.ts` — scenario definitions unchanged
- Any backend/API code

## Success Criteria

- User sees a "World Name" input when opening the scenario modal
- Input is pre-filled with the scenario title
- User can edit the name freely
- Clicking "Begin Novel" creates a story with the user's chosen name
- If user clears the name, falls back to scenario title
