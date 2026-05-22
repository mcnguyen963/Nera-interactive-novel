import { useAuthStore, useStoryStore, useUiStore } from '../../stores'
import { Button } from '../shared'

export function Header() {
  const { user, profile, logout } = useAuthStore()
  const { story, saveToCloud, loadFromCloud, deleteFromCloud, listCloudStories, isSyncing } = useStoryStore()
  const { addToast, openSettings } = useUiStore()

  async function handleSave() {
    if (!user || !story) return
    try {
      await saveToCloud(user.uid)
      addToast('Saved to cloud ✓', 'success')
    } catch {
      addToast('Save failed', 'error')
    }
  }

  async function handleLoad() {
    if (!user) return
    try {
      const stories = await listCloudStories(user.uid)
      if (stories.length === 0) {
        addToast('No cloud stories found', 'info')
        return
      }
      const latest = stories.sort((a, b) => b.updatedAt - a.updatedAt)[0]
      await loadFromCloud(latest.id, user.uid)
      addToast('Loaded from cloud ✓', 'success')
    } catch {
      addToast('Load failed', 'error')
    }
  }

  async function handleDelete() {
    if (!story) return
    try {
      await deleteFromCloud(story.id)
      addToast('Deleted from cloud', 'info')
    } catch {
      addToast('Delete failed', 'error')
    }
  }

  return (
    <header className="flex items-center justify-between px-12 py-4 border-b border-[var(--rule)] bg-[var(--page)] sticky top-0 z-50">
      <div className="font-[var(--font-head)] text-[0.85rem] tracking-[0.18em] text-[var(--accent)]">
        NERA
      </div>
      <div className="flex items-center gap-3">
        {user && !user.emailVerified && (
          <span className="text-[0.72rem] text-amber-600 italic">Verify email to use API</span>
        )}
        {story && (
          <>
            <Button onClick={handleSave} disabled={isSyncing} className="px-4 py-1.5 text-[0.9rem]">
              {isSyncing ? 'Saving…' : 'Save to Cloud'}
            </Button>
            <Button onClick={handleLoad} className="px-4 py-1.5 text-[0.9rem]">Load from Cloud</Button>
            <Button onClick={handleDelete} className="px-4 py-1.5 text-[0.9rem] text-red-600 border-red-200 hover:border-red-400">
              Delete
            </Button>
          </>
        )}
        <button
          onClick={openSettings}
          className="text-[var(--ink3)] hover:text-[var(--accent)] transition-colors text-[1.6rem] leading-none mx-1 px-1"
          title="Settings"
        >
          ⚙
        </button>
        {profile && (
          <span className="text-[0.75rem] text-[var(--ink3)] ml-2">
            {profile.displayName || profile.email}
          </span>
        )}
        {user && (
          <Button onClick={logout} className="px-4 py-1.5 text-[0.9rem]">Sign out</Button>
        )}
      </div>
    </header>
  )
}
