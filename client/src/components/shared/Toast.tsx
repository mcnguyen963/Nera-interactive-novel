import { useUiStore } from '../../stores/uiStore'

export function Toast() {
  const toasts = useUiStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-[18px] py-[7px] rounded-[20px] text-[0.78rem] text-white shadow-lg animate-[fadeIn_0.25s_ease-out] ${
            t.type === 'error' ? 'bg-red-700' : t.type === 'success' ? 'bg-green-700' : 'bg-[var(--ink)]'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
