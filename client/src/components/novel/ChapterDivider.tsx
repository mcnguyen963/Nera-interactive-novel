import { useState } from 'react'

interface ChapterDividerProps {
  title: string
  onTitleChange: (title: string) => void
}

export function ChapterDivider({ title, onTitleChange }: ChapterDividerProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)

  function handleBlur() {
    setEditing(false)
    if (value.trim() && value !== title) {
      onTitleChange(value.trim())
    } else {
      setValue(title)
    }
  }

  return (
    <div className="text-center font-[var(--font-head)] text-[0.9rem] tracking-[0.2em] text-[var(--ink3)] my-12 mb-7 flex items-center gap-3.5 before:flex-1 before:h-px before:bg-[var(--rule)] after:flex-1 after:h-px after:bg-[var(--rule)]">
      {editing ? (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleBlur() }}
          autoFocus
          className="bg-[var(--highlight)] text-[var(--accent)] text-center outline-none border-b border-[var(--accent)] px-2 font-[var(--font-head)]"
        />
      ) : (
        <span
          onClick={() => { setEditing(true); setValue(title) }}
          className="cursor-pointer hover:text-[var(--accent)] transition-colors"
        >
          {title}
        </span>
      )}
    </div>
  )
}
