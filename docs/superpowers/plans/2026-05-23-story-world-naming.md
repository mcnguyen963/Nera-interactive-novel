# Story World Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users name their story/world when creating a new novel by adding a text input pre-filled with the scenario title.

**Architecture:** Add a single `userWorldName` state variable to `HomePage.tsx`, render a text input at the top of the scenario modal, and wire `handleBegin` to use the user's input as the story title. No type, store, or backend changes needed.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 4, Vite, Vitest

---

## Task 1: Add `userWorldName` state and wire it in `handleSelect`

**Files:**
- Modify: `nera-interactive-novel/client/src/pages/HomePage.tsx:10-31`

- [ ] **Step 1: Add state and initialize in `handleSelect`**

In `HomePage.tsx`, after the existing state declarations (line 15), add:

```tsx
const [userWorldName, setUserWorldName] = useState('')
```

In the `handleSelect` function (line 25-31), add initialization of `userWorldName`:

```tsx
function handleSelect(s: ScenarioDef) {
  setSelected(s)
  setUserWorldName(s.title || '')  // ADD THIS LINE
  setUserSetting(s.setting || '')
  setUserChar(s.char || '')
  setUserRole(s.player || '')
  setUserHook(s.hook || '')
}
```

- [ ] **Step 2: Verify the file still compiles**

Run: `npx tsc --noEmit` from `nera-interactive-novel/client/`
Expected: No new errors related to HomePage.tsx

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/HomePage.tsx
git commit -m "feat: add userWorldName state to HomePage"
```

## Task 2: Add the "World Name" input field to the modal

**Files:**
- Modify: `nera-interactive-novel/client/src/pages/HomePage.tsx:140-199`

- [ ] **Step 1: Add the World Name input at the top of the modal**

In the `<Modal>` content (after line 141, before the existing Setting textarea), add:

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

This should be inserted between the `<h2>` title line and the first `<div className="flex flex-col gap-1.5 mb-3.5">` that contains the Setting textarea. Specifically, after line 142 (`</h2>`) and before line 143 (`<div className="flex flex-col gap-1.5 mb-3.5">`).

- [ ] **Step 2: Verify the file still compiles**

Run: `npx tsc --noEmit` from `nera-interactive-novel/client/`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/HomePage.tsx
git commit -m "feat: add World Name input to scenario modal"
```

## Task 3: Wire `handleBegin` to use the user's world name

**Files:**
- Modify: `nera-interactive-novel/client/src/pages/HomePage.tsx:33-68`

- [ ] **Step 1: Update the story title in `handleBegin`**

Change line 43 from:

```tsx
title: selected.title,
```

To:

```tsx
title: userWorldName || selected.title,
```

This ensures the user's chosen name is used as the story title, falling back to the scenario title if the user cleared the field.

- [ ] **Step 2: Verify the file still compiles**

Run: `npx tsc --noEmit` from `nera-interactive-novel/client/`
Expected: No new errors

- [ ] **Step 3: Run existing tests**

Run: `npm test` from `nera-interactive-novel/client/`
Expected: All existing tests pass (HomePage is not tested, so no test changes needed)

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/HomePage.tsx
git commit -m "feat: use userWorldName as story title in handleBegin"
```

## Task 4: Manual verification

- [ ] **Step 1: Start dev server and test manually**

Run: `npm run dev` from `nera-interactive-novel/` (runs both client and functions)

Then in browser:
1. Navigate to the app
2. Click any scenario card
3. Verify the modal opens with a "World Name" input pre-filled with the scenario title
4. Edit the world name, click "Begin Novel"
5. Verify the story uses the custom name
6. Clear the world name field, click "Begin Novel"
7. Verify the story falls back to the scenario title

- [ ] **Step 2: Commit any final adjustments**

```bash
git add client/src/pages/HomePage.tsx
git commit -m "chore: final adjustments for world naming"
```
